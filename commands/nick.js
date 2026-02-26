const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nick')
        .setDescription('Change a member’s nickname.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The member to rename')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('name')
                .setDescription('The new nickname')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        const newName = interaction.options.getString('name');
        
        await member.setNickname(newName);
        await interaction.editReply(`📝 **Success:** Nickname for **${member.user.tag}** changed to **${newName}**.`);
    },
};
