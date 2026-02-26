const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove timeout from a member.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to unmute')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        
        await member.timeout(null);
        await interaction.editReply(`🔊 Timeout removed for **${member.user.tag}**.`);
    },
};
