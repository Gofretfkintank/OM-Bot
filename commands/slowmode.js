const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set channel slowmode (ratelimit).')
        .addIntegerOption(option => 
            option.setName('sec')
                .setDescription('Slowmode duration in seconds')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        await interaction.deferReply();
        const seconds = interaction.options.getInteger('sec');
        
        await interaction.channel.setRateLimitPerUser(seconds);
        await interaction.editReply(`🐢 **Slowmode enabled:** Users can now chat every **${seconds}** seconds.`);
    },
};
