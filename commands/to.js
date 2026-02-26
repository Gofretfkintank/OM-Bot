const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('to').setDescription('Quick 10-minute timeout.').addUserOption(o=>o.setName('user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
        await i.deferReply();
        const m = i.options.getMember('user');
        await m.timeout(600000);
        await i.editReply(`🔇 **${m.user.tag}** silenced for 10 minutes. ⚡`);
    }
};
