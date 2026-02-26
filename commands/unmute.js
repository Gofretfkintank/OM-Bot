const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('unmute').setDescription('Remove a member’s timeout.').addUserOption(o=>o.setName('user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
        await i.deferReply();
        const m = i.options.getMember('user');
        await m.timeout(null);
        await i.editReply(`🔊 Timeout removed for **${m.user.tag}**. They can speak now! ✅`);
    }
};
