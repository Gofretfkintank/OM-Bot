const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unto')
        .setDescription('Quickly remove a timeout from a member.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to unmute quickly')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        
        await member.timeout(null);
        await interaction.editReply(`🔊 **${member.user.tag}** is back in the conversation! ✅`);
    },
};
