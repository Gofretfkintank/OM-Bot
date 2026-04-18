// commands/roulette.js
// European Roulette — 0-36, single zero.
// ─────────────────────────────────────────────────────────────────────────────
// Bet types:
//   number   → exact number 0-36  (35:1)
//   red/black                     (1:1)
//   odd/even                      (1:1)
//   low (1-18) / high (19-36)     (1:1)
//   dozen: 1st(1-12) 2nd(13-24) 3rd(25-36)  (2:1)
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const Economy = require('../models/Economy');

const cooldowns = new Map();
const COOLDOWN_MS = 15_000;

// European wheel — red numbers
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function spinWheel() {
    return Math.floor(Math.random() * 37); // 0-36
}

function numberColor(n) {
    if (n === 0) return '🟩 Green';
    return RED_NUMBERS.has(n) ? '🟥 Red' : '⬛ Black';
}

function evaluate(betType, betValue, result) {
    if (betType === 'number') {
        if (result === betValue) return { win: true, mult: 35, label: `Number ${betValue}` };
        return { win: false, mult: 0, label: `Number ${betValue}` };
    }
    if (betType === 'color') {
        if (result === 0) return { win: false, mult: 0, label: betValue };
        const isRed = RED_NUMBERS.has(result);
        if ((betValue === 'red' && isRed) || (betValue === 'black' && !isRed))
            return { win: true, mult: 1, label: betValue };
        return { win: false, mult: 0, label: betValue };
    }
    if (betType === 'parity') {
        if (result === 0) return { win: false, mult: 0, label: betValue };
        if ((betValue === 'odd' && result % 2 === 1) || (betValue === 'even' && result % 2 === 0))
            return { win: true, mult: 1, label: betValue };
        return { win: false, mult: 0, label: betValue };
    }
    if (betType === 'range') {
        if (result === 0) return { win: false, mult: 0, label: betValue };
        if ((betValue === 'low'  && result >= 1  && result <= 18) ||
            (betValue === 'high' && result >= 19 && result <= 36))
            return { win: true, mult: 1, label: betValue };
        return { win: false, mult: 0, label: betValue };
    }
    if (betType === 'dozen') {
        if (result === 0) return { win: false, mult: 0, label: betValue };
        const dozens = { '1st': [1,12], '2nd': [13,24], '3rd': [25,36] };
        const [lo, hi] = dozens[betValue];
        if (result >= lo && result <= hi) return { win: true, mult: 2, label: `${betValue} dozen` };
        return { win: false, mult: 0, label: `${betValue} dozen` };
    }
    return { win: false, mult: 0, label: '?' };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Spin the European roulette wheel.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(3000)
        )
        .addStringOption(opt =>
            opt.setName('type')
                .setDescription('Bet type')
                .setRequired(true)
                .addChoices(
                    { name: 'Number (0-36) — 35:1', value: 'number' },
                    { name: 'Red — 1:1',             value: 'red'    },
                    { name: 'Black — 1:1',           value: 'black'  },
                    { name: 'Odd — 1:1',             value: 'odd'    },
                    { name: 'Even — 1:1',            value: 'even'   },
                    { name: 'Low (1-18) — 1:1',      value: 'low'    },
                    { name: 'High (19-36) — 1:1',    value: 'high'   },
                    { name: '1st Dozen (1-12) — 2:1',  value: '1st'  },
                    { name: '2nd Dozen (13-24) — 2:1', value: '2nd'  },
                    { name: '3rd Dozen (25-36) — 2:1', value: '3rd'  }
                )
        )
        .addIntegerOption(opt =>
            opt.setName('number')
                .setDescription('Exact number to bet on (only for Number type)')
                .setMinValue(0)
                .setMaxValue(36)
        ),

    async execute(interaction) {
        const userId  = interaction.user.id;
        const last    = cooldowns.get(userId);

        if (last && Date.now() - last < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
            return interaction.reply({ content: `⏳ Cooldown: **${left}s** remaining.`, ephemeral: true });
        }

        const bet     = interaction.options.getInteger('bet');
        const rawType = interaction.options.getString('type');

        // Determine betType + betValue
        let betType, betValue;
        if (rawType === 'number') {
            betType  = 'number';
            const n  = interaction.options.getInteger('number');
            if (n === null || n === undefined) {
                return interaction.reply({ content: '❌ Provide a number (0-36) when betting on a specific number.', ephemeral: true });
            }
            betValue = n;
        } else if (['red', 'black'].includes(rawType)) {
            betType  = 'color';
            betValue = rawType;
        } else if (['odd', 'even'].includes(rawType)) {
            betType  = 'parity';
            betValue = rawType;
        } else if (['low', 'high'].includes(rawType)) {
            betType  = 'range';
            betValue = rawType;
        } else if (['1st', '2nd', '3rd'].includes(rawType)) {
            betType  = 'dozen';
            betValue = rawType;
        }

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

        // Spin animation
        const spinEmbed = new EmbedBuilder()
            .setColor(0xf5c518)
            .setTitle('🎡 Roulette — Spinning...')
            .setDescription('`🌀 🌀 🌀`')
            .setFooter({ text: `Bet: ${bet.toLocaleString()} 🪙` });

        const msg = await interaction.reply({ embeds: [spinEmbed], fetchReply: true });
        await new Promise(r => setTimeout(r, 1200));

        const result = spinWheel();
        const color  = numberColor(result);
        const { win, mult, label } = evaluate(betType, betValue, result);

        let payout = 0;
        if (win) {
            payout = bet + (bet * mult); // return bet + winnings
            const freshWallet = await Economy.findOne({ userId });
            await freshWallet.addCoins(payout);
        }

        const resultEmbed = new EmbedBuilder()
            .setColor(win ? 0x00c851 : 0xff4444)
            .setTitle('🎡 Roulette')
            .setDescription(
                `The ball landed on **${result}** — ${color}\n\n` +
                (win
                    ? `🎉 **${label} wins! +${payout.toLocaleString()} 🪙** (×${mult + 1} return)`
                    : `💀 **${label} loses. -${bet.toLocaleString()} 🪙**`)
            )
            .addFields(
                { name: 'Result', value: `**${result}** ${color}`, inline: true },
                { name: 'Your bet', value: `${label}`, inline: true },
                { name: 'Payout', value: `${payout.toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: 'OM Casino — European (single zero)' });

        await msg.edit({ embeds: [resultEmbed] });
    }
};
