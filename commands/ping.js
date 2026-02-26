const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency.'),
    async execute(i) {
        await i.deferReply();
        await i.editReply(`🏓 **Pong!** Latency: **${i.client.ws.ping}ms**`);
    }
};
