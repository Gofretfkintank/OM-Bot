const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode.').addIntegerOption(o=>o.setName('sec').setDescription('Seconds').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(i) {
        await i.deferReply();
        const s = i.options.getInteger('sec');
        await i.channel.setRateLimitPerUser(s);
        await i.editReply(`🐢 Slowmode set to **${s} seconds**. ⏳`);
    }
};
