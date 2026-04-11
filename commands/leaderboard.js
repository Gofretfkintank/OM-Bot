//--------------------------
// LEADERBOARD COMMAND
//--------------------------
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DriverRating = require('../models/DriverRating');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Shows the driver rankings based on overall rating'),

    async execute(interaction) {

        //--------------------------
        // FETCH DATA
        //--------------------------
        const drivers = await DriverRating.find();

        if (!drivers.length) {
            return interaction.reply({
                content: 'No driver data found.',
                ephemeral: true
            });
        }

        //--------------------------
        // SORT BY OVERALL
        //--------------------------
        const sorted = drivers.sort((a, b) => b.avg.overall - a.avg.overall);

        //--------------------------
        // GET TOP 10
        //--------------------------
        const top = sorted.slice(0, 10);

        //--------------------------
        // BUILD DESCRIPTION
        //--------------------------
        let description = '';

        top.forEach((driver, index) => {

            let position;

            if (index === 0) position = '🥇';
            else if (index === 1) position = '🥈';
            else if (index === 2) position = '🥉';
            else position = `**${index + 1}.**`;

            description += `${position} ${driver.name || 'Unknown'} - **${driver.avg.overall}**\n`;
        });

        //--------------------------
        // CREATE EMBED
        //--------------------------
        const embed = new EmbedBuilder()
            .setTitle('🏆 Driver Leaderboard')
            .setDescription(description || 'Leaderboard is empty.')
            .setColor('Red')
            .setFooter({ text: `Total Drivers: ${drivers.length}` })
            .setTimestamp();

        //--------------------------
        // SEND RESPONSE
        //--------------------------
        await interaction.reply({ embeds: [embed] });
    }
};