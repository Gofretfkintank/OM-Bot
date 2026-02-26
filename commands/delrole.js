const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delrole')
        .setDescription('Delete an existing role from the server.')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to delete')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        await interaction.deferReply();
        const role = interaction.options.getRole('role');
        
        await role.delete();
        await interaction.editReply(`🗑️ **Success:** The role has been successfully deleted.`);
    },
};
