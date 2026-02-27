const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// Helper function for duration (No library needed for mobile users)
function parseDuration(str) {
    const regex = /(\d+)([smhd])/g;
    let totalMs = 0;
    let match;
    let found = false;
    while ((match = regex.exec(str)) !== null) {
        found = true;
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': totalMs += value * 1000; break;
            case 'm': totalMs += value * 60 * 1000; break;
            case 'h': totalMs += value * 60 * 60 * 1000; break;
            case 'd': totalMs += value * 24 * 60 * 60 * 1000; break;
        }
    }
    return found ? totalMs : null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('🔇 Mute a member using Discord timeout.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('👤 Member to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('⏱ Duration (e.g., 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('📝 Reason for mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        let member;

        try {
            // FIX: "Member not found" - Fetching member directly from the server
            member = await interaction.guild.members.fetch(targetUser.id);
        } catch (err) {
            return interaction.reply({ 
                content: '❌ Member not found in this server.', 
                flags: [MessageFlags.Ephemeral] // FIX: Using flags instead of deprecated ephemeral: true
            });
        }

        const durationString = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (member.id === interaction.user.id)
            return interaction.reply({ content: '⚠️ You cannot mute yourself.', flags: [MessageFlags.Ephemeral] });

        if (!member.moderatable)
            return interaction.reply({ content: '❌ I cannot mute this member. Check my role position!', flags: [MessageFlags.Ephemeral] });

        const milliseconds = parseDuration(durationString);

        if (!milliseconds || milliseconds <= 0) {
            return interaction.reply({ 
                content: '❌ Invalid format! Use: `10m`, `1h`, `1d`.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        try {
            await member.timeout(milliseconds, reason);
            return interaction.reply(`🔇 **${member.user.tag}** has been muted.\n⏱ **Duration:** ${durationString}\n📝 **Reason:** ${reason}`);
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Failed to mute the member.', flags: [MessageFlags.Ephemeral] });
        }
    },
};
