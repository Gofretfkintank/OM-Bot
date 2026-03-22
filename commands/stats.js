// commands/stats.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('path');

const driversFile = path.join(__dirname, '../drivers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show racing stats for a user')
        .addUserOption(option =>
            option.setName('user')
                  .setDescription('The user to view stats for')
                  .setRequired(false)),
    
    async execute(interaction) {
        // Hedef kullanıcı
        const targetUser = interaction.options.getUser('user') || interaction.user;

        // JSON oku
        let drivers;
        try {
            drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));
        } catch (error) {
            return interaction.reply({ content: '❌ Veri tabanı okunamadı.', ephemeral: true });
        }

        const driver = drivers.find(d => d.userId === targetUser.id);

        if (!driver) {
            return interaction.reply({ content: `❌ No stats found for **${targetUser.username}**`, ephemeral: true });
        }

        // Kazanma oranını hesapla (Eğer adamın hiç yarışı yoksa sıfıra bölme hatası vermemesi için kontrol ekledim)
        const winRate = driver.races > 0 ? ((driver.wins / driver.races) * 100).toFixed(1) : 0;

        // Çok Şık Embed Mesajı Oluştur
        const statsEmbed = new EmbedBuilder()
            .setColor('#E60000') // Yarış hissiyatı veren Ferrari/F1 kırmızısı
            .setTitle(`🏎️ Racing Career: ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 })) // Sağ üste avatarı koyar
            .addFields(
                // İlk satır (Yan yana 3 sütun)
                { name: '🏎️ Races', value: `**${driver.races}**`, inline: true },
                { name: '🏆 Wins', value: `**${driver.wins}**`, inline: true },
                { name: '🥇 Podiums', value: `**${driver.podiums}**`, inline: true },
                
                // İkinci satır (Yan yana 3 sütun)
                { name: '💀 DNF', value: `**${driver.dnf}**`, inline: true },
                { name: '⚡ DNS', value: `**${driver.dns}**`, inline: true },
                { name: '✨ Win Rate', value: `**%${winRate}**`, inline: true },

                // Alt Kısım (Geniş tek satır)
                { name: '👑 Championships', value: `WDC: **${driver.wdc}** |  WCC: **${driver.wcc}**`, inline: false }
            )
            .setFooter({ 
                text: 'Official Racing Stats', 
                iconURL: interaction.guild ? interaction.guild.iconURL() : undefined 
            })
            .setTimestamp(); // En alta güncel saat ve tarihi atar

        // Mesajı gönder
        await interaction.reply({ embeds: [statsEmbed], ephemeral: false });
    }
};
