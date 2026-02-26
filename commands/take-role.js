const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('take-role').setDescription('Remove a role from a user.').addUserOption(o=>o.setName('user').setRequired(true)).addRoleOption(o=>o.setName('role').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(i) {
        await i.deferReply();
        const m = i.options.getMember('user');
        const r = i.options.getRole('role');
        await m.roles.remove(r);
        await i.editReply(`❌ **${r.name}** removed from **${m.user.tag}**. 🎭`);
    }
};
