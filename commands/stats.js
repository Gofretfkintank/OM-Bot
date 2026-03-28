const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const driversPath = './drivers.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show stats')
        .addUserOption(opt =>
            opt.setName('user').setRequired(false)
        ),

    async execute(interaction) {

        const user = interaction.options.getUser('user') || interaction.user;
        const drivers = JSON.parse(fs.readFileSync(driversPath, 'utf8'));

        const d = drivers[user.id];

        if (!d) {
            return interaction.reply({ content: '❌ No data', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${user.username} Stats`)
            .setColor('#E10600')
            .addFields(
                { name: 'Races', value: `${d.races}`, inline: true },
                { name: 'Wins', value: `${d.wins}`, inline: true },
                { name: 'Podiums', value: `${d.podiums}`, inline: true },
                { name: 'DOTY', value: `${d.doty}`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    }
};