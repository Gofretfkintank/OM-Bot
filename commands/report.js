const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Report a user to the staff team.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user you want to report')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for reporting')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        
        const logChannel = interaction.guild.channels.cache.get(process.env.REPORT_LOG_ID);
        if (!logChannel) return interaction.editReply('❌ **Error:** Staff log channel not found.');
        
        const embed = new EmbedBuilder()
            .setTitle('📩 New Report Received')
            .addFields(
                { name: 'Reporter', value: interaction.user.tag, inline: true },
                { name: 'Target', value: target.tag, inline: true },
                { name: 'Reason', value: reason }
            )
            .setColor('Red')
            .setTimestamp();
            
        await logChannel.send({ embeds: [embed] });
        await interaction.editReply('✅ **Success:** Your report has been submitted to staff.');
    },
};
