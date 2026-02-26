const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editrole')
        .setDescription('Rename an existing role.')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to rename')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('name')
                .setDescription('The new name for the role')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        await interaction.deferReply();
        const role = interaction.options.getRole('role');
        const newName = interaction.options.getString('name');
        
        await role.setName(newName);
        await interaction.editReply(`✏️ **Success:** Role name has been updated to **${newName}**.`);
    },
};
