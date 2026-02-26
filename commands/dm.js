const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message through the bot.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to message')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('msg')
                .setDescription('The content of the message')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const user = interaction.options.getUser('user');
        const message = interaction.options.getString('msg');
        
        try {
            await user.send(`📩 **Direct Message from ${interaction.guild.name}:**\n${message}`);
            await interaction.editReply(`✅ **Success:** DM sent to **${user.tag}**.`);
        } catch (error) {
            await interaction.editReply('❌ **Failed:** This user has their DMs closed.');
        }
    },
};
