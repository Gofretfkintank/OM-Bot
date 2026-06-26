// commands/poker.js
// Texas Hold'em Poker — 2-6 players, standard rules.
// Buy-in deducted on start. Hole cards sent via DM.
// Buttons: Fold / Check-Call / Raise (+BB) / All-In
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const Economy = require('../models/Economy');

// ── Deck ──────────────────────────────────────────────────────────────────────
const SUITS = ['♠️','♥️','♦️','♣️'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const VALS  = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

function createDeck() {
    return SUITS.flatMap(s => RANKS.map(r => ({ rank:r, suit:s, value:VALS[r] })));
}
function shuffle(d) {
    for (let i = d.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [d[i],d[j]] = [d[j],d[i]];
    }
    return d;
}
function cStr(c) { return `${c.rank}${c.suit}`; }
function hStr(cards) { return cards.map(cStr).join('  '); }

// ── Hand evaluation (best 5 from 7) ──────────────────────────────────────────
function combos5(arr) {
    const out = [];
    for (let a=0;a<arr.length-4;a++)
    for (let b=a+1;b<arr.length-3;b++)
    for (let c=b+1;c<arr.length-2;c++)
    for (let d=c+1;d<arr.length-1;d++)
    for (let e=d+1;e<arr.length;e++)
        out.push([arr[a],arr[b],arr[c],arr[d],arr[e]]);
    return out;
}

function isStraight(vals) {
    const u = [...new Set(vals)].sort((a,b)=>b-a);
    if (u.length < 5) return false;
    if (u[0]-u[4] === 4 && u.length >= 5) return true;
    return u[0]===14 && u[1]===5 && u[2]===4 && u[3]===3 && u[4]===2;
}

function evalFive(cards) {
    const vals  = cards.map(c=>c.value).sort((a,b)=>b-a);
    const suits = cards.map(c=>c.suit);
    const flush = suits.every(s=>s===suits[0]);
    const str   = isStraight(vals);
    const cnt   = {};
    vals.forEach(v => cnt[v]=(cnt[v]||0)+1);
    const grp   = Object.entries(cnt).map(([v,c])=>[+v,c]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);

    if (flush && str) return { r: vals[0]===14&&vals[1]===13 ? 10 : 9,
                               name: vals[0]===14&&vals[1]===13 ? 'Royal Flush':'Straight Flush', t:vals };
    if (grp[0][1]===4)                      return { r:8, name:'Four of a Kind',  t:vals };
    if (grp[0][1]===3 && grp[1]?.[1]===2)  return { r:7, name:'Full House',       t:vals };
    if (flush)                               return { r:6, name:'Flush',            t:vals };
    if (str)                                 return { r:5, name:'Straight',          t:vals };
    if (grp[0][1]===3)                       return { r:4, name:'Three of a Kind',  t:vals };
    if (grp[0][1]===2 && grp[1]?.[1]===2)  return { r:3, name:'Two Pair',          t:vals };
    if (grp[0][1]===2)                       return { r:2, name:'One Pair',          t:vals };
    return                                          { r:1, name:'High Card',          t:vals };
}

function cmpTie(a,b) {
    for (let i=0;i<Math.min(a.length,b.length);i++) if (a[i]!==b[i]) return a[i]-b[i];
    return 0;
}

function bestHand(seven) {
    let best = null;
    for (const c of combos5(seven)) {
        const h = evalFive(c);
        if (!best || h.r > best.r || (h.r===best.r && cmpTie(h.t,best.t)>0)) best = h;
    }
    return best;
}

// ── Game state ────────────────────────────────────────────────────────────────
const games = new Map(); // channelId → game

function mkPlayer(userId, username) {
    return { userId, username, cards:[], chips:0, bet:0, folded:false, allIn:false, hand:null };
}

function mkGame(hostId, hostName, buyIn) {
    const sb = Math.max(50, Math.floor(buyIn/10));
    return {
        status:'waiting', buyIn, pot:0,
        players:[mkPlayer(hostId,hostName)],
        deck:[], community:[],
        currentBet:0, actorIdx:0, dealerIdx:0,
        mustAct: new Set(),
        smallBlind:sb, bigBlind:sb*2,
        channelId:null
    };
}

// ── mustAct helpers ───────────────────────────────────────────────────────────
const actives = g => g.players.filter(p => !p.folded && !p.allIn);

function initMustAct(g)   { g.mustAct = new Set(actives(g).map(p=>p.userId)); }

function applyAct(g, actor, action) {
    if (action === 'fold') {
        actor.folded = true;
        g.mustAct.delete(actor.userId);
    } else if (action === 'check' || action === 'call') {
        g.mustAct.delete(actor.userId);
    } else { // raise / allin
        g.mustAct = new Set(actives(g).filter(p=>p.userId!==actor.userId).map(p=>p.userId));
    }
}

function nextActor(g) {
    if (g.mustAct.size === 0) return;
    let idx = (g.actorIdx+1) % g.players.length;
    for (let t=0; t<g.players.length; t++, idx=(idx+1)%g.players.length)
        if (g.mustAct.has(g.players[idx].userId)) { g.actorIdx=idx; return; }
}

// ── Street transitions ────────────────────────────────────────────────────────
function startStreet(g) {
    g.players.forEach(p => { p.bet=0; });
    g.currentBet = 0;
    let idx = (g.dealerIdx+1) % g.players.length;
    for (let t=0; t<g.players.length; t++, idx=(idx+1)%g.players.length)
        if (!g.players[idx].folded && !g.players[idx].allIn) { g.actorIdx=idx; break; }
    initMustAct(g);
}

function advanceStreet(g) {
    if      (g.status==='preflop') { g.community.push(g.deck.pop(),g.deck.pop(),g.deck.pop()); g.status='flop'; }
    else if (g.status==='flop')    { g.community.push(g.deck.pop()); g.status='turn'; }
    else if (g.status==='turn')    { g.community.push(g.deck.pop()); g.status='river'; }
    else                           { g.status='showdown'; return true; }
    startStreet(g);
    return false;
}

// ── Showdown & payout ─────────────────────────────────────────────────────────
function resolveShowdown(g) {
    const alive = g.players.filter(p=>!p.folded);
    if (alive.length===1) {
        alive[0].chips += g.pot;
        return [{ p:alive[0], payout:g.pot, handName:'Last standing' }];
    }
    for (const p of alive) p.hand = bestHand([...p.cards,...g.community]);
    const winners = alive.filter(p => {
        return alive.every(q =>
            p.hand.r > q.hand.r || (p.hand.r===q.hand.r && cmpTie(p.hand.t,q.hand.t)>=0)
        );
    });
    const share = Math.floor(g.pot/winners.length);
    winners.forEach(w => { w.chips+=share; });
    return winners.map(w => ({ p:w, payout:share, handName:w.hand.name }));
}

async function payOut(g) {
    for (const p of g.players)
        if (p.chips > 0) {
            const w = await Economy.findOne({ userId:p.userId });
            if (w) await w.addCoins(p.chips);
        }
    games.delete(g.channelId);
}

// ── Embeds ────────────────────────────────────────────────────────────────────
const STREET = { preflop:'Pre-Flop', flop:'Flop', turn:'Turn', river:'River', showdown:'Showdown', waiting:'Lobby' };

function lobbyEmbed(g) {
    return new EmbedBuilder()
        .setColor(0x1a472a)
        .setTitle('🃏 Texas Hold\'em Poker')
        .setDescription(`**Buy-in:** ${g.buyIn.toLocaleString()} 🪙  ·  **Blinds:** ${g.smallBlind} / ${g.bigBlind}\n\nWaiting for players... *(min 2 · max 6)*`)
        .addFields({ name:`Players (${g.players.length}/6)`, value:g.players.map(p=>`• ${p.username}`).join('\n') })
        .setFooter({ text:'OM Casino — Hole cards are sent via DM after deal' });
}

function gameEmbed(g, results=null) {
    const commStr = g.community.length ? g.community.map(cStr).join('  ') : '*(not dealt yet)*';
    const actor   = g.players[g.actorIdx];

    const lines = g.players.map(p => {
        const s   = p.folded ? ' *(folded)*' : p.allIn ? ' *(all-in)*' : '';
        const hnd = results && !p.folded ? `  \`${hStr(p.cards)}\` — **${p.hand?.name||'?'}**` : '';
        const tag = p.folded ? '~~' : '';
        return `${tag}${p.username}${tag}${s}: **${p.chips.toLocaleString()} chips** · bet ${p.bet}${hnd}`;
    }).join('\n');

    const e = new EmbedBuilder()
        .setColor(results ? 0xffd700 : 0x1a472a)
        .setTitle(`🃏 Hold'em — ${STREET[g.status]||g.status}`)
        .addFields(
            { name:`🂠 Community  ·  Pot: ${g.pot.toLocaleString()} chips`, value:commStr },
            { name:'Players', value:lines }
        )
        .setFooter({ text:'OM Casino — Texas Hold\'em' });

    if (results) {
        e.addFields({ name:'🏆 Result', value:results.map(r=>`**${r.p.username}** — ${r.handName} — won **${r.payout.toLocaleString()} 🪙**`).join('\n') });
    } else if (actor) {
        e.addFields(
            { name:'Action on',   value:`**${actor.username}**`, inline:true },
            { name:'Current Bet', value:`${g.currentBet} chips`, inline:true }
        );
    }
    return e;
}

// ── Buttons ───────────────────────────────────────────────────────────────────
function lobbyRow(canStart) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pk_join').setLabel('🪑 Join').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pk_start').setLabel('▶️ Start').setStyle(ButtonStyle.Primary).setDisabled(!canStart)
    );
}

function actionRow(g) {
    const actor    = g.players[g.actorIdx];
    const toCall   = Math.max(0, g.currentBet - actor.bet);
    const canCheck = toCall === 0;
    const raiseCost = toCall + g.bigBlind;

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pk_fold').setLabel('🚫 Fold').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('pk_call')
            .setLabel(canCheck ? '✅ Check' : `📞 Call (${Math.min(toCall,actor.chips)})`)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('pk_raise')
            .setLabel(`⬆️ Raise (+${g.bigBlind})`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(actor.chips < raiseCost),
        new ButtonBuilder().setCustomId('pk_allin')
            .setLabel(`💸 All-In (${actor.chips})`)
            .setStyle(ButtonStyle.Danger)
    );
}

// ── Game collector ────────────────────────────────────────────────────────────
function startGameCollector(g, msg) {
    const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => g.players[g.actorIdx]?.userId === i.user.id,
        time: 300_000
    });

    const finish = async (results) => {
        await payOut(g);
        await msg.edit({ embeds:[gameEmbed(g,results)], components:[] }).catch(()=>{});
    };

    collector.on('collect', async i => {
        await i.deferUpdate();
        const actor = g.players[g.actorIdx];
        let action  = 'check';

        if (i.customId === 'pk_fold') {
            action = 'fold';

        } else if (i.customId === 'pk_call') {
            const toCall = Math.min(Math.max(0, g.currentBet-actor.bet), actor.chips);
            actor.chips -= toCall;
            actor.bet   += toCall;
            g.pot       += toCall;
            if (actor.chips===0) actor.allIn=true;
            action = toCall===0 ? 'check' : 'call';

        } else if (i.customId === 'pk_raise') {
            const toCall   = Math.min(Math.max(0, g.currentBet-actor.bet), actor.chips);
            const raiseAmt = Math.min(g.bigBlind, actor.chips-toCall);
            const total    = toCall+raiseAmt;
            actor.chips   -= total;
            actor.bet     += total;
            g.pot         += total;
            g.currentBet   = actor.bet;
            if (actor.chips===0) actor.allIn=true;
            action = 'raise';

        } else if (i.customId === 'pk_allin') {
            const all   = actor.chips;
            actor.bet  += all;
            actor.chips = 0;
            actor.allIn = true;
            g.pot      += all;
            if (actor.bet > g.currentBet) g.currentBet = actor.bet;
            action = 'allin';
        }

        applyAct(g, actor, action);

        // Only one player standing?
        if (g.players.filter(p=>!p.folded).length===1) {
            collector.stop('done');
            g.status='showdown';
            return finish(resolveShowdown(g));
        }

        // Street done?
        if (g.mustAct.size===0) {
            const showdown = advanceStreet(g);
            if (showdown) { collector.stop('done'); return finish(resolveShowdown(g)); }
        } else {
            nextActor(g);
        }

        await msg.edit({ embeds:[gameEmbed(g)], components:[actionRow(g)] });
    });

    collector.on('end', async (_,reason) => {
        if (reason==='done') return;
        const actor = g.players[g.actorIdx];
        if (actor && !actor.folded) { actor.folded=true; }
        const alive = g.players.filter(p=>!p.folded);
        if (alive.length>=1) { g.status='showdown'; await finish(resolveShowdown(g)); }
        else {
            games.delete(g.channelId);
            await msg.edit({ embeds:[new EmbedBuilder().setColor(0x888888).setTitle('🃏 Poker').setDescription('⏱️ Game timed out.')], components:[] }).catch(()=>{});
        }
    });
}

// ── Command ───────────────────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Multiplayer Texas Hold\'em Poker! 2-6 players.')
        .addIntegerOption(opt =>
            opt.setName('buyin')
                .setDescription('Buy-in amount in coins (each player pays this to play)')
                .setRequired(true)
                .setMinValue(200)
                .setMaxValue(10000)
        ),

    async execute(interaction) {
        const channelId = interaction.channelId;
        if (games.has(channelId))
            return interaction.reply({ content:'❌ There\'s already a poker game running in this channel!', ephemeral:true });

        const buyIn = interaction.options.getInteger('buyin');
        const g     = mkGame(interaction.user.id, interaction.user.username, buyIn);
        g.channelId = channelId;
        games.set(channelId, g);

        const msg = await interaction.reply({ embeds:[lobbyEmbed(g)], components:[lobbyRow(false)], fetchReply:true });

        // ── Lobby collector ───────────────────────────────────────────────────
        const lobby = msg.createMessageComponentCollector({ componentType:ComponentType.Button, time:120_000 });

        lobby.on('collect', async i => {
            // ── Join ──────────────────────────────────────────────────────────
            if (i.customId==='pk_join') {
                if (g.players.find(p=>p.userId===i.user.id))
                    return i.reply({ content:'✋ You\'re already in!', ephemeral:true });
                if (g.players.length>=6)
                    return i.reply({ content:'❌ Game is full (6/6).', ephemeral:true });
                const w = await Economy.findOne({ userId:i.user.id });
                if (!w || w.coins < buyIn)
                    return i.reply({ content:`❌ Need **${buyIn.toLocaleString()} 🪙** to join. Balance: **${(w?.coins||0).toLocaleString()} 🪙**`, ephemeral:true });
                g.players.push(mkPlayer(i.user.id, i.user.username));
                return i.update({ embeds:[lobbyEmbed(g)], components:[lobbyRow(g.players.length>=2)] });
            }

            // ── Start ─────────────────────────────────────────────────────────
            if (i.customId==='pk_start') {
                if (i.user.id!==g.players[0].userId)
                    return i.reply({ content:'❌ Only the host can start the game.', ephemeral:true });
                if (g.players.length<2)
                    return i.reply({ content:'❌ Need at least 2 players.', ephemeral:true });
                lobby.stop('started');

                // Deduct buy-ins
                for (const p of g.players) {
                    const w = await Economy.findOne({ userId:p.userId });
                    if (!w || w.coins < buyIn) {
                        games.delete(channelId);
                        return i.update({
                            embeds:[new EmbedBuilder().setColor(0xff4444).setTitle('❌ Poker Cancelled').setDescription(`${p.username} doesn't have enough coins anymore!`)],
                            components:[]
                        });
                    }
                    w.coins -= buyIn;
                    await w.save();
                    p.chips = buyIn;
                }

                // Deal hole cards
                g.deck = shuffle(createDeck());
                for (const p of g.players) p.cards = [g.deck.pop(), g.deck.pop()];

                // Post blinds
                const n     = g.players.length;
                const sbIdx = n===2 ? 0 : 1%n;  // heads-up: dealer=SB
                const bbIdx = n===2 ? 1 : 2%n;
                g.dealerIdx = n===2 ? 0 : 0;
                g.bbIdx     = bbIdx;

                const postBlind = (idx, amt) => {
                    const p = g.players[idx];
                    const paid = Math.min(amt, p.chips);
                    p.chips -= paid; p.bet += paid; g.pot += paid;
                    if (p.chips===0) p.allIn=true;
                };
                postBlind(sbIdx, g.smallBlind);
                postBlind(bbIdx, g.bigBlind);
                g.currentBet = g.bigBlind;
                g.status     = 'preflop';
                g.actorIdx   = (bbIdx+1)%n;
                initMustAct(g);

                // DM hole cards
                for (const p of g.players) {
                    try {
                        const user = await interaction.client.users.fetch(p.userId);
                        await user.send(
                            `🃏 **OM Casino — Texas Hold'em**\n` +
                            `Your hole cards: \`${hStr(p.cards)}\`\n` +
                            `*(Check #${interaction.channel?.name||'the channel'} for game updates)*`
                        );
                    } catch { /* DMs closed — they'll have to remember */ }
                }

                await i.update({ embeds:[gameEmbed(g)], components:[actionRow(g)] });
                startGameCollector(g, msg);
            }
        });

        lobby.on('end', (_,reason) => {
            if (reason==='started') return;
            games.delete(channelId);
            msg.edit({ embeds:[new EmbedBuilder().setColor(0x888888).setTitle('🃏 Poker').setDescription('⏱️ Lobby timed out — no game started.')], components:[] }).catch(()=>{});
        });
    }
};
