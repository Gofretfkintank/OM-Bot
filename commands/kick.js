const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getMember('target');
        
        if (!user.kickable) return interaction.editReply('❌ **Error:** I cannot kick this user.');
        
        await user.kick();
        await interaction.editReply(`🔫 **${user.user.tag}** User session has been terminated by the OM Bot.`);
    },
};
