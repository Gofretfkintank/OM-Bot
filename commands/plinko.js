// commands/plinko.js
// Plinko — drop a ball through 8 rows of pins. Where it lands = your multiplier.
// Three risk levels with different bucket distributions.
// ─────────────────────────────────────────────────────────────────────────────

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Economy = require('../models/Economy');

const cooldowns   = new Map();
const COOLDOWN_MS = 15_000;

const ROWS = 8; // 8 pin rows → 9 buckets (positions 0-8)

// ── Risk tables (9-bucket symmetric, center = worst) ─────────────────────────
const RISK = {
    low:  {
        mults:  [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
        emoji:  '🟢',
        label:  'Low Risk',
        color:  0x00c851
    },
    mid:  {
        mults:  [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
        emoji:  '🟡',
        label:  'Medium Risk',
        color:  0xf5c518
    },
    high: {
        mults:  [29, 4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
        emoji:  '🔴',
        label:  'High Risk',
        color:  0xff8800
    }
};

// ── Simulate ball drop (binomial: count rights out of ROWS flips) ─────────────
function simulate() {
    let pos = 0;
    for (let i = 0; i < ROWS; i++) {
        if (Math.random() < 0.5) pos++;
    }
    return pos; // 0-8
}

// ── Visual bucket bar with landing position highlighted ───────────────────────
function bucketBar(risk, landedPos) {
    return risk.mults.map((m, i) => {
        const label = `${m}×`;
        return i === landedPos ? `**[${label}]**` : label;
    }).join(' · ');
}

// ── Ball path visual (simplified top-to-bottom emoji strip) ──────────────────
function pathVisual(landedPos) {
    // Show relative left/right position over 4 display rows using block chars
    const center = 4; // center bucket index
    const offset = landedPos - center; // -4 to +4
    const dir    = offset < 0 ? '↙' : offset > 0 ? '↘' : '↓';
    const steps  = ['🔵', '⚫⚫', '⚫⚫⚫', '🎯'];
    return steps.map((s, idx) => {
        const pad = ' '.repeat(Math.abs(Math.round(offset * idx / 3)));
        return offset < 0 ? pad + s : s + pad;
    }).join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('plinko')
        .setDescription('Drop the ball and watch it bounce into a multiplier bucket!')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(100)
                .setMaxValue(25000)
        )
        .addStringOption(opt =>
            opt.setName('risk')
                .setDescription('Risk level — changes the multiplier spread')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Low Risk  — safe, smaller swings',          value: 'low'  },
                    { name: '🟡 Medium Risk — balanced risk/reward',         value: 'mid'  },
                    { name: '🔴 High Risk  — rare jackpot, brutal center',   value: 'high' }
                )
        ),

    async execute(interaction) {
        const userId  = interaction.user.id;
        const last    = cooldowns.get(userId);
        if (last && Date.now() - last < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
            return interaction.reply({ content: `⏳ Cooldown: **${left}s** remaining.`, ephemeral: true });
        }

        const bet     = interaction.options.getInteger('bet');
        const riskKey = interaction.options.getString('risk');
        const risk    = RISK[riskKey];

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

        // ── Drop ──────────────────────────────────────────────────────────────
        const pos    = simulate();
        const mult   = risk.mults[pos];
        const payout = Math.floor(bet * mult);

        // ── Animation frame ───────────────────────────────────────────────────
        const dropEmbed = new EmbedBuilder()
            .setColor(0xf5c518)
            .setTitle(`🎳 Plinko — ${risk.emoji} ${risk.label}`)
            .setDescription('`🔵 dropping through pins...`')
            .addFields(
                { name: 'Bet',  value: `${bet.toLocaleString()} 🪙`,  inline: true },
                { name: 'Risk', value: `${risk.emoji} ${risk.label}`, inline: true }
            )
            .setFooter({ text: 'OM Casino' });

        const msg = await interaction.reply({ embeds: [dropEmbed], fetchReply: true });
        await new Promise(r => setTimeout(r, 1300));

        // ── Payout ────────────────────────────────────────────────────────────
        if (payout > 0) {
            const fw = await Economy.findOne({ userId });
            await fw.addCoins(payout);
        }

        const won  = mult > 1;
        const even = mult === 1;

        const resultEmbed = new EmbedBuilder()
            .setColor(won ? risk.color : even ? 0xaaaaaa : 0xff4444)
            .setTitle(`🎳 Plinko — ${risk.emoji} ${risk.label}`)
            .setDescription(
                `The ball landed on **${mult}×** bucket!\n\n` +
                bucketBar(risk, pos)
            )
            .addFields(
                { name: 'Bet',        value: `${bet.toLocaleString()} 🪙`,    inline: true },
                { name: 'Multiplier', value: `**${mult}×**`,                   inline: true },
                { name: 'Payout',     value: `${payout.toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: `OM Casino — Plinko · ${ROWS} rows · ${risk.label}` });

        await msg.edit({ embeds: [resultEmbed] });
    }
};
