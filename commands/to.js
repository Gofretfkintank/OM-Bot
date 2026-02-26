const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('to')
        .setDescription('Quick 10-minute timeout for a member.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to silence for 10 minutes')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        
        await member.timeout(600000); // 10 minutes
        await interaction.editReply(`🔇 **${member.user.tag}** has been silenced for 10 minutes. ⚡`);
    },
};
