const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot’s current latency.'),
    async execute(interaction) {
        await interaction.deferReply();
        await interaction.editReply(`🏓 **Pong!** Latency is **${interaction.client.ws.ping}ms**.`);
    },
};
