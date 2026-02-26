const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('give-role').setDescription('Assign a role to a user.').addUserOption(o=>o.setName('user').setRequired(true)).addRoleOption(o=>o.setName('role').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(i) {
        await i.deferReply();
        const m = i.options.getMember('user');
        const r = i.options.getRole('role');
        await m.roles.add(r);
        await i.editReply(`✅ **${r.name}** assigned to **${m.user.tag}**. 🎭`);
    }
};
