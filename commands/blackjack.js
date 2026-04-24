// commands/blackjack.js
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const Economy = require('../models/Economy');

// ── Cooldown: 30s per user ────────────────────────────────────────────────────
const cooldowns = new Map();
const COOLDOWN_MS = 30_000;

// ── Deck ──────────────────────────────────────────────────────────────────────
const SUITS  = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function buildDeck() {
    const deck = [];
    for (const suit of SUITS)
        for (const val of VALUES)
            deck.push({ suit, val });
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardValue(card) {
    if (['J', 'Q', 'K'].includes(card.val)) return 10;
    if (card.val === 'A') return 11;
    return parseInt(card.val);
}

function handTotal(hand) {
    let total = hand.reduce((s, c) => s + cardValue(c), 0);
    let aces  = hand.filter(c => c.val === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}

function cardStr(card) { return `${card.val}${card.suit}`; }
function handStr(hand) { return hand.map(cardStr).join('  '); }

function buildEmbed(playerHand, dealerHand, hideDealer, bet, status, color) {
    const playerTotal = handTotal(playerHand);
    const dealerShown = hideDealer
        ? `${cardStr(dealerHand[0])}  🂠`
        : handStr(dealerHand);
    const dealerTotal = hideDealer ? '?' : handTotal(dealerHand);

    return new EmbedBuilder()
        .setColor(color)
        .setTitle('🃏 Blackjack')
        .addFields(
            { name: `Your Hand (${playerTotal})`, value: handStr(playerHand), inline: false },
            { name: `Dealer's Hand (${dealerTotal})`, value: dealerShown, inline: false }
        )
        .setDescription(status)
        .setFooter({ text: `Bet: ${bet.toLocaleString()} 🪙` });
}

function buildButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('bj_hit')
            .setLabel('Hit')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👊')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('bj_stand')
            .setLabel('Stand')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✋')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('bj_double')
            .setLabel('Double Down')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚡')
            .setDisabled(disabled)
    );
}

// ── Command ───────────────────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play a hand of blackjack against the dealer.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(100)
                .setMaxValue(50000)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;

        // Cooldown check
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

        // Deduct bet immediately
        wallet.coins -= bet;
        await wallet.save();

        // Deal
        const deck = shuffle(buildDeck());
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        // Natural blackjack check
        if (handTotal(playerHand) === 21) {
            const payout = Math.floor(bet * 2.5); // 3:2
            await wallet.addCoins(payout);
            const embed = buildEmbed(playerHand, dealerHand, false, bet,
                `🎉 **Blackjack! You win ${payout.toLocaleString()} 🪙** (3:2 payout)`, 0x00c851);
            return interaction.reply({ embeds: [embed] });
        }

        const embed = buildEmbed(playerHand, dealerHand, true, bet,
            '**Your turn.** Hit, Stand, or Double Down?', 0xf5c518);

        const msg = await interaction.reply({ embeds: [embed], components: [buildButtons()], fetchReply: true });

        // Button collector
        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 60_000
        });

        let doubled = false;
        let currentBet = bet;

        collector.on('collect', async i => {
            await i.deferUpdate();

            // ── HIT ──────────────────────────────────────────────────────
            if (i.customId === 'bj_hit') {
                playerHand.push(deck.pop());
                const total = handTotal(playerHand);

                if (total > 21) {
                    collector.stop('bust');
                    const embed = buildEmbed(playerHand, dealerHand, false, currentBet,
                        `💥 **Bust! You lose ${currentBet.toLocaleString()} 🪙**`, 0xff4444);
                    return msg.edit({ embeds: [embed], components: [buildButtons(true)] });
                }

                if (total === 21) {
                    collector.stop('stand');
                    return;
                }

                const embed = buildEmbed(playerHand, dealerHand, true, currentBet,
                    '**Your turn.** Hit, Stand, or Double Down?', 0xf5c518);
                await msg.edit({ embeds: [embed], components: [buildButtons()] });
            }

            // ── DOUBLE DOWN ───────────────────────────────────────────────
            if (i.customId === 'bj_double') {
                // Re-check balance
                const freshWallet = await Economy.findOne({ userId });
                if (!freshWallet || freshWallet.coins < currentBet) {
                    const embed = buildEmbed(playerHand, dealerHand, true, currentBet,
                        `❌ Not enough coins to double. Continuing...`, 0xf5c518);
                    return msg.edit({ embeds: [embed], components: [buildButtons()] });
                }

                freshWallet.coins -= currentBet;
                await freshWallet.save();
                currentBet *= 2;
                doubled = true;

                playerHand.push(deck.pop());
                collector.stop('stand'); // auto-stand after double
            }

            // ── STAND ─────────────────────────────────────────────────────
            if (i.customId === 'bj_stand') {
                collector.stop('stand');
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'bust') return; // already handled

            if (reason === 'time') {
                const embed = buildEmbed(playerHand, dealerHand, false, currentBet,
                    `⏰ **Timed out. Bet forfeited.**`, 0x888888);
                return msg.edit({ embeds: [embed], components: [buildButtons(true)] });
            }

            // Dealer plays
            while (handTotal(dealerHand) < 17) dealerHand.push(deck.pop());

            const playerTotal = handTotal(playerHand);
            const dealerTotal = handTotal(dealerHand);

            const freshWallet = await Economy.findOne({ userId });

            let result, color, payout = 0;

            if (dealerTotal > 21 || playerTotal > dealerTotal) {
                payout = currentBet * 2;
                result = `🏆 **You win! +${payout.toLocaleString()} 🪙**`;
                color = 0x00c851;
                await freshWallet.addCoins(payout);
            } else if (playerTotal === dealerTotal) {
                payout = currentBet;
                result = `🤝 **Push — bet returned. ${payout.toLocaleString()} 🪙**`;
                color = 0xf5c518;
                await freshWallet.addCoins(payout);
            } else {
                result = `💀 **Dealer wins. You lose ${currentBet.toLocaleString()} 🪙**`;
                color = 0xff4444;
            }

            if (doubled) result += ' *(doubled down)*';

            const embed = buildEmbed(playerHand, dealerHand, false, currentBet, result, color);
            await msg.edit({ embeds: [embed], components: [buildButtons(true)] });
        });
    }
};
