const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('editrole').setDescription('Edit a role name.').addRoleOption(o=>o.setName('role').setRequired(true)).addStringOption(o=>o.setName('name').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(i) {
        await i.deferReply();
        const r = i.options.getRole('role');
        const n = i.options.getString('name');
        await r.setName(n);
        await i.editReply(`✏️ Role updated! New name: **${n}**`);
    }
};
