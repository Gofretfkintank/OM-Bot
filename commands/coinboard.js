// commands/coinboard.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Economy = require('../models/Economy');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinboard')
        .setDescription('En zengin 10 pilotu listeler.'),

    async execute(interaction) {
        await interaction.deferReply();

        const top = await Economy.find({ coins: { $gt: 0 } })
            .sort({ coins: -1 })
            .limit(10);

        if (!top.length) {
            return interaction.editReply('❌ Nobody has earned any coins yet.');
        }

        const lines = await Promise.all(
            top.map(async (entry, i) => {
                const medal = MEDALS[i] ?? `**${i + 1}.**`;
                let name;
                try {
                    const member = await interaction.guild.members.fetch(entry.userId);
                    name = member.displayName;
                } catch {
                    name = `<@${entry.userId}>`;
                }
                return `${medal} ${name} — **${entry.coins.toLocaleString()} 🪙**`;
            })
        );

        // Sorgulayan kullanıcının sırası
        const selfWallet = await Economy.findOne({ userId: interaction.user.id });
        let selfRank = '';
        if (selfWallet) {
            const rank = await Economy.countDocuments({ coins: { $gt: selfWallet.coins } });
            selfRank = `\n\n📍 Your rank: **#${rank + 1}** | **${selfWallet.coins.toLocaleString()} 🪙**`;
        }

        const embed = new EmbedBuilder()
            .setColor(0xf5c518)
            .setTitle('🏦 OM Coin Liderboard')
            .setDescription(lines.join('\n') + selfRank)
            .setFooter({ text: 'OM Economy System' })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};
