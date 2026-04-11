//--------------------------
// LEADERBOARD KOMUTU
//--------------------------
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DriverRating = require('../models/DriverRating');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Pilotların overall puanına göre sıralamasını gösterir'),

    async execute(interaction) {

        //--------------------------
        // VERİLERİ ÇEK
        //--------------------------
        const drivers = await DriverRating.find();

        if (!drivers.length) {
            return interaction.reply({
                content: 'Hiç veri bulunamadı.',
                ephemeral: true
            });
        }

        //--------------------------
        // SIRALA (OVERALL)
        //--------------------------
        const sorted = drivers.sort((a, b) => b.avg.overall - a.avg.overall);

        //--------------------------
        // TOP 10 AL
        //--------------------------
        const top = sorted.slice(0, 10);

        //--------------------------
        // METİN OLUŞTUR
        //--------------------------
        let desc = '';

        top.forEach((driver, index) => {
            desc += `**${index + 1}.** ${driver.username || 'Bilinmeyen'} - **${driver.avg.overall}**\n`;
        });

        //--------------------------
        // EMBED
        //--------------------------
        const embed = new EmbedBuilder()
            .setTitle('🏆 Driver Leaderboard')
            .setDescription(desc || 'Liste boş.')
            .setColor('Red')
            .setFooter({ text: `Toplam Pilot: ${drivers.length}` })
            .setTimestamp();

        //--------------------------
        // GÖNDER
        //--------------------------
        await interaction.reply({ embeds: [embed] });
    }
};