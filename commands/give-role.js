const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give-role')
        .setDescription('Assign a role to a member.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to receive the role')
                .setRequired(true))
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to give')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');
        
        await member.roles.add(role);
        await interaction.editReply(`✅ **Success:** **${role.name}** has been assigned to **${member.user.tag}**. 🎭`);
    },
};
