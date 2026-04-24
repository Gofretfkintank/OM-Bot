// commands/crash.js
// Crash Game — bet and cash out before the multiplier crashes.
// ─────────────────────────────────────────────────────────────────────────────
// Multiplier starts at 1.00× and climbs.
// You pick a target (auto cash-out). If it reaches your target → win.
// Crash point is random (house edge baked in).
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const Economy = require('../models/Economy');

const cooldowns = new Map();
const COOLDOWN_MS = 20_000;
const HOUSE_EDGE  = 0.04; // 4% house edge on crash point

// Provably fair-ish crash point generation
function generateCrashPoint() {
    // Exponential distribution — skews toward lower multipliers
    const r = Math.random();
    if (r < 0.01) return 1.00; // 1% instant crash
    const crash = Math.max(1.01, (1 / (1 - r)) * (1 - HOUSE_EDGE));
    return Math.floor(crash * 100) / 100; // 2 decimal places
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crash')
        .setDescription('Bet on the crash multiplier. Pick your target and hope it holds.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(100)
                .setMaxValue(30000)
        )
        .addNumberOption(opt =>
            opt.setName('target')
                .setDescription('Auto cash-out multiplier (e.g. 2.0 = double your money)')
                .setRequired(true)
                .setMinValue(1.1)
                .setMaxValue(50)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;

        const last = cooldowns.get(userId);
        if (last && Date.now() - last < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
            return interaction.reply({ content: `⏳ Cooldown: **${left}s** remaining.`, ephemeral: true });
        }

        const bet    = interaction.options.getInteger('bet');
        const target = Math.floor(interaction.options.getNumber('target') * 100) / 100;

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

        // Generate hidden crash point
        const crashAt = generateCrashPoint();

        // Animate: show climbing multiplier
        const steps = [];
        let current = 1.00;
        const step  = 0.10;

        while (current < Math.min(crashAt, target) - 0.05) {
            current = Math.floor((current + step) * 100) / 100;
            steps.push(current);
        }

        const launchEmbed = new EmbedBuilder()
            .setColor(0xf5c518)
            .setTitle('🚀 Crash — Launching...')
            .setDescription('`🟢 1.00×`\n\n*Climbing...*')
            .addFields(
                { name: 'Bet',    value: `${bet.toLocaleString()} 🪙`,   inline: true },
                { name: 'Target', value: `${target.toFixed(2)}×`,        inline: true }
            )
            .setFooter({ text: 'OM Casino' });

        const msg = await interaction.reply({ embeds: [launchEmbed], fetchReply: true });

        // Short animation delay
        await new Promise(r => setTimeout(r, 800));

        const won    = crashAt >= target;
        const finalX = won ? target : crashAt;
        const payout = won ? Math.floor(bet * target) : 0;

        if (won) {
            const freshWallet = await Economy.findOne({ userId });
            await freshWallet.addCoins(payout);
        }

        const resultEmbed = new EmbedBuilder()
            .setColor(won ? 0x00c851 : 0xff4444)
            .setTitle(won ? '✅ Cashed Out!' : '💥 Crashed!')
            .setDescription(
                won
                    ? `Reached **${finalX.toFixed(2)}×** — cashed out!\n**+${payout.toLocaleString()} 🪙**`
                    : `Crashed at **${finalX.toFixed(2)}×** before your target of **${target.toFixed(2)}×**.\n**-${bet.toLocaleString()} 🪙**`
            )
            .addFields(
                { name: 'Bet',       value: `${bet.toLocaleString()} 🪙`,    inline: true },
                { name: 'Target',    value: `${target.toFixed(2)}×`,          inline: true },
                { name: 'Crash at',  value: `${crashAt.toFixed(2)}×`,         inline: true },
                { name: 'Payout',    value: `${payout.toLocaleString()} 🪙`,  inline: true }
            )
            .setFooter({ text: 'OM Casino' });

        await msg.edit({ embeds: [resultEmbed] });
    }
};
