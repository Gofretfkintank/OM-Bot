const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('unban').setDescription('Remove a user’s ban.').addStringOption(o=>o.setName('id').setDescription('User ID to unban').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(i) {
        await i.deferReply();
        const id = i.options.getString('id');
        await i.guild.members.unban(id);
        await i.editReply(`✅ **Success:** User ID \`${id}\` has been unbanned. 🔓`);
    }
};
