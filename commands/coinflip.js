// commands/coinflip.js
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const Economy = require('../models/Economy');

const cooldowns = new Map();
const COOLDOWN_MS = 10_000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin — double or nothing.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(3000)
        )
        .addStringOption(opt =>
            opt.setName('side')
                .setDescription('Heads or Tails?')
                .setRequired(true)
                .addChoices(
                    { name: '🪙 Heads', value: 'heads' },
                    { name: '🔁 Tails', value: 'tails' }
                )
        ),

    async execute(interaction) {
        const userId = interaction.user.id;

        const last = cooldowns.get(userId);
        if (last && Date.now() - last < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
            return interaction.reply({ content: `⏳ Cooldown: **${left}s** remaining.`, ephemeral: true });
        }

        const bet  = interaction.options.getInteger('bet');
        const pick = interaction.options.getString('side');

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

        // Flip animation
        const spinEmbed = new EmbedBuilder()
            .setColor(0xf5c518)
            .setTitle('🪙 Flipping...')
            .setDescription('`🌀 🌀 🌀`')
            .setFooter({ text: `Bet: ${bet.toLocaleString()} 🪙  |  Your pick: ${pick}` });

        const msg = await interaction.reply({ embeds: [spinEmbed], fetchReply: true });
        await new Promise(r => setTimeout(r, 1000));

        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won    = result === pick;
        const payout = won ? bet * 2 : 0;

        if (won) {
            const freshWallet = await Economy.findOne({ userId });
            await freshWallet.addCoins(payout);
        }

        const resultEmbed = new EmbedBuilder()
            .setColor(won ? 0x00c851 : 0xff4444)
            .setTitle(won ? '🎉 You called it!' : '💀 Wrong side.')
            .setDescription(
                `The coin landed on **${result === 'heads' ? '🪙 Heads' : '🔁 Tails'}**.\n\n` +
                (won
                    ? `**+${payout.toLocaleString()} 🪙** — nice call!`
                    : `**-${bet.toLocaleString()} 🪙** — better luck next time.`)
            )
            .addFields(
                { name: 'Your pick', value: pick,   inline: true },
                { name: 'Result',    value: result,  inline: true },
                { name: 'Payout',    value: `${payout.toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: 'OM Casino' });

        await msg.edit({ embeds: [resultEmbed] });
    }
};
