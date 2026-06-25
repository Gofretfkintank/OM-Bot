// commands/highlow.js
// Hi-Lo — guess if the next card is Higher or Lower.
// Chain correct guesses to multiply your winnings, cash out anytime.
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

const cooldowns   = new Map();
const COOLDOWN_MS = 20_000;

const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS  = ['♠️','♥️','♦️','♣️'];
const VALUES = { A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13 };

const ROUND_MULT = 1.8;
const MAX_ROUNDS = 5;

function randCard() {
    const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    return { rank, suit, value: VALUES[rank] };
}

function cardStr(c) {
    return `${c.rank}${c.suit}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('highlow')
        .setDescription('Guess if the next card is Higher or Lower. Chain correct guesses for bigger multipliers!')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(100)
                .setMaxValue(25000)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;

        const last = cooldowns.get(userId);
        if (last && Date.now() - last < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
            return interaction.reply({ content: `⏳ Cooldown: **${left}s** remaining.`, ephemeral: true });
        }

        const bet = interaction.options.getInteger('bet');
        let wallet = await Economy.findOne({ userId });
        if (!wallet) wallet = new Economy({ userId });

        if (wallet.coins < bet) {
            return interaction.reply({
                content: `❌ Not enough coins. Balance: **${wallet.coins.toLocaleString()} 🪙**`,
                ephemeral: true
            });
        }

        cooldowns.set(userId, Date.now());
        wallet.coins -= bet;
        await wallet.save();

        let card  = randCard();
        let round = 0;
        let pot   = bet;

        // ── Embed builder ─────────────────────────────────────────────────────
        const makeEmbed = (status = 'playing', prevCard = null) => {
            const e = new EmbedBuilder()
                .setTitle('🃏 Hi-Lo — Higher or Lower?')
                .addFields(
                    { name: 'Current Card', value: `\`${cardStr(card)}\``,              inline: true },
                    { name: 'Round',        value: `${round} / ${MAX_ROUNDS}`,           inline: true },
                    { name: 'Pot',          value: `${Math.floor(pot).toLocaleString()} 🪙`, inline: true }
                )
                .setFooter({ text: 'OM Casino • Ties = free re-draw • Max 5 rounds' });

            switch (status) {
                case 'playing':
                    e.setColor(0x2f3136)
                     .setDescription(`Is the next card **Higher** or **Lower** than \`${cardStr(card)}\`?`);
                    break;
                case 'tie':
                    e.setColor(0x888888)
                     .setDescription(`🤝 **Tie!** Both \`${cardStr(prevCard)}\` — re-drawing.\nIs the next card Higher or Lower than \`${cardStr(card)}\`?`);
                    break;
                case 'win':
                    e.setColor(0x00c851)
                     .setDescription(`🏆 All ${MAX_ROUNDS} rounds cleared! You won **${Math.floor(pot).toLocaleString()} 🪙**!`);
                    break;
                case 'lose':
                    e.setColor(0xff4444)
                     .setDescription(`💀 Wrong guess! The card was \`${cardStr(card)}\`. Lost **${bet.toLocaleString()} 🪙**.`);
                    break;
                case 'cashout':
                    e.setColor(0xf5c518)
                     .setDescription(`💰 Cashed out **${Math.floor(pot).toLocaleString()} 🪙** after round ${round}!`);
                    break;
                case 'timeout':
                    e.setColor(0x888888)
                     .setDescription('⏱️ Timed out. Bet refunded.');
                    break;
            }
            return e;
        };

        // ── Button row ────────────────────────────────────────────────────────
        const makeRow = (disabled = false) => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('hl_hi')
                .setLabel('⬆️ Higher')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId('hl_lo')
                .setLabel('⬇️ Lower')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId('hl_out')
                .setLabel(round > 0
                    ? `💰 Cash Out — ${Math.floor(pot).toLocaleString()} 🪙`
                    : '💰 Cash Out')
                .setStyle(ButtonStyle.Success)
                .setDisabled(disabled || round === 0)
        );

        const msg = await interaction.reply({
            embeds:     [makeEmbed()],
            components: [makeRow()],
            fetchReply: true
        });

        // ── Collector ─────────────────────────────────────────────────────────
        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter:        i => i.user.id === userId,
            time:          60_000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            // ── Cash out ──────────────────────────────────────────────────────
            if (i.customId === 'hl_out') {
                const fw = await Economy.findOne({ userId });
                await fw.addCoins(Math.floor(pot));
                collector.stop('cashout');
                return msg.edit({ embeds: [makeEmbed('cashout')], components: [makeRow(true)] });
            }

            const next = randCard();

            // ── Tie → free re-draw ────────────────────────────────────────────
            if (next.value === card.value) {
                const prev = card;
                card = next;
                return msg.edit({ embeds: [makeEmbed('tie', prev)], components: [makeRow()] });
            }

            const guessedHi = i.customId === 'hl_hi';
            const actualHi  = next.value > card.value;
            card = next;

            // ── Wrong guess ───────────────────────────────────────────────────
            if (guessedHi !== actualHi) {
                collector.stop('lose');
                return msg.edit({ embeds: [makeEmbed('lose')], components: [makeRow(true)] });
            }

            // ── Correct guess ─────────────────────────────────────────────────
            round++;
            pot = pot * ROUND_MULT;

            if (round >= MAX_ROUNDS) {
                const fw = await Economy.findOne({ userId });
                await fw.addCoins(Math.floor(pot));
                collector.stop('win');
                return msg.edit({ embeds: [makeEmbed('win')], components: [makeRow(true)] });
            }

            return msg.edit({ embeds: [makeEmbed()], components: [makeRow()] });
        });

        collector.on('end', async (_, reason) => {
            if (['cashout', 'win', 'lose'].includes(reason)) return;
            // Timeout handling
            if (round > 0) {
                const fw = await Economy.findOne({ userId });
                await fw.addCoins(Math.floor(pot));
                await msg.edit({ embeds: [makeEmbed('cashout')], components: [makeRow(true)] });
            } else {
                const fw = await Economy.findOne({ userId });
                await fw.addCoins(bet);
                await msg.edit({ embeds: [makeEmbed('timeout')], components: [makeRow(true)] });
            }
        });
    }
};
