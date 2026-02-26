const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a formal warning to a member.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for the warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        
        let warns = JSON.parse(fs.readFileSync('./warns.json', 'utf8') || '{}');
        if (!warns[user.id]) warns[user.id] = [];
        
        warns[user.id].push({
            reason: reason,
            moderator: interaction.user.tag,
            date: new Date().toLocaleDateString()
        });
        
        fs.writeFileSync('./warns.json', JSON.stringify(warns, null, 2));
        await interaction.editReply(`⚠️ **${user.tag}** has been warned. Reason: **${reason}**`);
    },
};
