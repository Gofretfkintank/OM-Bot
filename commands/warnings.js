const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Check the warning history of a member.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check warnings for')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('user');
        
        let warns = JSON.parse(fs.readFileSync('./warns.json', 'utf8') || '{}');
        const history = warns[user.id]?.map((w, i) => `\`${i + 1}.\` **Reason:** ${w.reason} (By: ${w.moderator})`).join('\n') || 'This user has no warnings. ✅';
        
        await interaction.editReply(`📋 **Warning History for ${user.tag}:**\n${history}`);
    },
};
