// commands/slots.js
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const Economy = require('../models/Economy');

const cooldowns = new Map();
const COOLDOWN_MS = 15_000;

// ── Symbols — weighted (higher weight = more common) ──────────────────────────
const SYMBOLS = [
    { emoji: '🏎️', name: 'Bolide',    weight: 6,  mult: 10  }, // jackpot
    { emoji: '🏆', name: 'Trophy',    weight: 8,  mult: 6   },
    { emoji: '🥇', name: 'Gold',      weight: 12, mult: 4   },
    { emoji: '⚡', name: 'Power',     weight: 15, mult: 2.5 },
    { emoji: '🔧', name: 'Wrench',    weight: 18, mult: 1.5 },
    { emoji: '⛽', name: 'Fuel',      weight: 20, mult: 1.2 },
    { emoji: '🏁', name: 'Flag',      weight: 21, mult: 0   }, // loss
];

function weightedPick() {
    const total = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
    let rand = Math.random() * total;
    for (const sym of SYMBOLS) {
        rand -= sym.weight;
        if (rand <= 0) return sym;
    }
    return SYMBOLS[SYMBOLS.length - 1];
}

function spin() {
    return [weightedPick(), weightedPick(), weightedPick()];
}

function evaluate(reels, bet) {
    const [a, b, c] = reels;

    // Three of a kind
    if (a.emoji === b.emoji && b.emoji === c.emoji) {
        const payout = Math.floor(bet * a.mult);
        if (a.mult === 10) return { result: `🎰 **JACKPOT! ${a.emoji}${b.emoji}${c.emoji}**`, payout, color: 0xffd700 };
        return { result: `🎉 **Three ${a.name}s! +${payout.toLocaleString()} 🪙**`, payout, color: 0x00c851 };
    }

    // Two of a kind (first two or last two, higher pays)
    if (a.emoji === b.emoji && a.mult > 0) {
        const payout = Math.floor(bet * 0.5);
        return { result: `✨ **Pair! +${payout.toLocaleString()} 🪙**`, payout, color: 0xf5c518 };
    }
    if (b.emoji === c.emoji && b.mult > 0) {
        const payout = Math.floor(bet * 0.4);
        return { result: `✨ **Pair! +${payout.toLocaleString()} 🪙**`, payout, color: 0xf5c518 };
    }

    return { result: `💨 **No match. You lose ${bet.toLocaleString()} 🪙**`, payout: 0, color: 0xff4444 };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Spin the OM slot machine.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(2000)
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

        // Spin animation (2 stages)
        const spinning = new EmbedBuilder()
            .setColor(0xf5c518)
            .setTitle('🎰 Slots — Spinning...')
            .setDescription('`🔄  🔄  🔄`')
            .setFooter({ text: `Bet: ${bet.toLocaleString()} 🪙` });

        const msg = await interaction.reply({ embeds: [spinning], fetchReply: true });

        await new Promise(r => setTimeout(r, 1200));

        const reels = spin();
        const { result, payout, color } = evaluate(reels, bet);

        // Pay out
        if (payout > 0) {
            const freshWallet = await Economy.findOne({ userId });
            await freshWallet.addCoins(payout);
        }

        const reelStr = reels.map(r => r.emoji).join('  ');

        const resultEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle('🎰 Slots')
            .setDescription(`\`${reelStr}\`\n\n${result}`)
            .addFields(
                { name: 'Bet',    value: `${bet.toLocaleString()} 🪙`, inline: true },
                { name: 'Payout', value: `${payout.toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: 'OM Casino' });

        await msg.edit({ embeds: [resultEmbed] });
    }
};
