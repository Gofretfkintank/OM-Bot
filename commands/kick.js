const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

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
        
        if (!user) return interaction.editReply('❌ **Error:** This user is not in the server.');
        if (!user.kickable) return interaction.editReply('❌ **Error:** I cannot kick this user.');
        
        await user.kick();

        // Embed oluşturma
        const kickEmbed = new EmbedBuilder()
            .setColor(0x2ecc71) // Yeşil renk
            .setDescription(`🔫 **${user.user.tag}** User session has been terminated by the OM Bot.`);

        await interaction.editReply({ embeds: [kickEmbed] });
    },
};
