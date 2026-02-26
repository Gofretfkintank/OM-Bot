const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote-remove')
        .setDescription('Delete a poll message using its ID.')
        .addStringOption(option => 
            option.setName('id')
                .setDescription('The ID of the poll message')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const messageId = interaction.options.getString('id');
        
        try {
            const pollMessage = await interaction.channel.messages.fetch(messageId);
            await pollMessage.delete();
            await interaction.editReply('🗑️ **Success:** Poll message has been deleted.');
        } catch (error) {
            await interaction.editReply('❌ **Error:** Message not found or already deleted.');
        }
    },
};
