// commands/wallet.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Economy = require('../models/Economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('Coin bakiyeni ve istatistiklerini gösterir.')
        .addUserOption(opt =>
            opt.setName('pilot')
                .setDescription('Başka bir pilotur cüzdanına bak (opsiyonel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('pilot') ?? interaction.user;

        let wallet = await Economy.findOne({ userId: target.id });

        if (!wallet) {
            if (target.id === interaction.user.id) {
                // İlk kez sorgulanıyor → kayıt oluştur
                wallet = new Economy({ userId: target.id });
                await wallet.save();
            } else {
                return interaction.reply({
                    content: `❌ **${target.username}** henüz herhangi bir kazanım elde etmemiş.`,
                    ephemeral: true
                });
            }
        }

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        const displayName = member?.displayName ?? target.username;

        const embed = new EmbedBuilder()
            .setColor(0xf5c518)
            .setAuthor({
                name: `${displayName}'in Cüzdanı`,
                iconURL: target.displayAvatarURL({ dynamic: true })
            })
            .addFields(
                { name: '🪙 Coins', value: `**${wallet.coins.toLocaleString()}**`, inline: true },
                { name: '📈 Toplam Kazanılan', value: `**${wallet.totalEarned.toLocaleString()}**`, inline: true },
                { name: '🏁 Arcane Level', value: `Lap **${wallet.level}**`, inline: true },
                { name: '✅ Doğru Cevap', value: `**${wallet.correctAnswers}**`, inline: true },
            )
            .setFooter({ text: 'OM Economy System' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
