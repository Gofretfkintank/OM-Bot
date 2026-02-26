const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-warning')
        .setDescription('Completely clear all warnings for a user.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose warnings will be deleted')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('user');
        
        let warns = JSON.parse(fs.readFileSync('./warns.json', 'utf8') || '{}');
        if (warns[user.id]) {
            delete warns[user.id];
            fs.writeFileSync('./warns.json', JSON.stringify(warns, null, 2));
            await interaction.editReply(`✅ All warnings for **${user.tag}** have been cleared. ♻️`);
        } else {
            await interaction.editReply('❌ This user has no warnings to clear.');
        }
    },
};
