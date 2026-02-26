const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('delrole').setDescription('Delete a role.').addRoleOption(o=>o.setName('role').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(i) {
        await i.deferReply();
        const r = i.options.getRole('role');
        await r.delete();
        await i.editReply(`🗑️ Role **${r.name}** has been successfully deleted.`);
    }
};
