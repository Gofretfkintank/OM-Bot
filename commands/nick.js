const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('nick').setDescription('Change nickname.').addUserOption(o=>o.setName('user').setDescription('Target user').setRequired(true)).addStringOption(o=>o.setName('name').setDescription('New nickname').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    async execute(i) {
        await i.deferReply();
        const m = i.options.getMember('user');
        const n = i.options.getString('name');
        await m.setNickname(n);
        await i.editReply(`📝 Nickname for **${m.user.tag}** changed to **${n}**.`);
    }
};
