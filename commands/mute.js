const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('mute').setDescription('Timeout a member.').addUserOption(o=>o.setName('user').setRequired(true)).addIntegerOption(o=>o.setName('time').setDescription('Duration in minutes').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
        await i.deferReply();
        const m = i.options.getMember('user');
        const t = i.options.getInteger('time');
        await m.timeout(t * 60000);
        await i.editReply(`🔇 **${m.user.tag}** has been muted for ${t} minutes. ⏱️`);
    }
};
