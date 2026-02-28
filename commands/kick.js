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
        
        // Eğer kullanıcı sunucuda değilse botun çökmesini engellemek için kontrol
        if (!user) return interaction.editReply('❌ **Error:** This user is not in the server.');
        
        // Botun yetkisi yetmiyor mu kontrolü
        if (!user.kickable) return interaction.editReply('❌ **Error:** I cannot kick this user.');
        
        await user.kick();
        // Orijinal mesajın korunmuştur
        await interaction.editReply(`🔫 **${user.user.tag}** User session has been terminated by the OM Bot.`);
    },
};
