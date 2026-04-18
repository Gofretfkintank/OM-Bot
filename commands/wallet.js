// commands/wallet.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Economy = require('../models/Economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('Shows your coin balance and stats.')
        .addUserOption(opt =>
            opt.setName('driver')
                .setDescription('Check another driver\'s wallet (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('driver') ?? interaction.user;

        let wallet = await Economy.findOne({ userId: target.id });

        if (!wallet) {
            if (target.id === interaction.user.id) {
                // İlk kez sorgulanıyor → kayıt oluştur
                wallet = new Economy({ userId: target.id });
                await wallet.save();
            } else {
                return interaction.reply({
                    content: `❌ **${target.username}** hasn't earned anything yet.`,
                    ephemeral: true
                });
            }
        }

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        const displayName = member?.displayName ?? target.username;

        const embed = new EmbedBuilder()
            .setColor(0xf5c518)
            .setAuthor({
                name: `${displayName}'s Wallet`,
                iconURL: target.displayAvatarURL({ dynamic: true })
            })
            .addFields(
                { name: '🪙 Coins', value: `**${wallet.coins.toLocaleString()}**`, inline: true },
                { name: '📈 Total Earned', value: `**${wallet.totalEarned.toLocaleString()}**`, inline: true },
                { name: '🏁 Arcane Level', value: `Lap **${wallet.level}**`, inline: true },
                { name: '✅ Correct Answers', value: `**${wallet.correctAnswers}**`, inline: true },
            )
            .setFooter({ text: 'OM Economy System' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
