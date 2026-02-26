const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('unto').setDescription('Quickly remove a timeout.').addUserOption(o=>o.setName('user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
        await i.deferReply();
        const m = i.options.getMember('user');
        await m.timeout(null);
        await i.editReply(`🔊 **${m.user.tag}** is back in the conversation! ✅`);
    }
};
