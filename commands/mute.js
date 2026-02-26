const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a member (Mute).')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('time')
                .setDescription('Duration in minutes')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        const duration = interaction.options.getInteger('time');
        
        await member.timeout(duration * 60000);
        await interaction.editReply(`🔇 **${member.user.tag}** has been muted for ${duration} minutes.`);
    },
};
