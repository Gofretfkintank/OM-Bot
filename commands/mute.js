const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ms = require('ms'); // Required for converting '1h', '10m' etc. to milliseconds

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('🔇 Mute a member using Discord timeout.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('👤 Member to mute')
                .setRequired(true))
        .addStringOption(option => // Changed from Integer to String to support "1h 10m"
            option.setName('duration')
                .setDescription('⏱ Duration (e.g., 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('📝 Reason for mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const member = interaction.options.getMember('target');
        const durationString = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!member)
            return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

        if (member.id === interaction.user.id)
            return interaction.reply({ content: '⚠️ You cannot mute yourself.', ephemeral: true });

        if (!member.moderatable)
            return interaction.reply({ content: '❌ I cannot mute this member.', ephemeral: true });

        // Convert string (e.g., '1h') to milliseconds
        const milliseconds = ms(durationString);

        // Validation for the duration format
        if (!milliseconds || milliseconds <= 0) {
            return interaction.reply({ 
                content: '❌ Invalid duration format! Use examples like: `10m`, `1h`, `1d`.', 
                ephemeral: true 
            });
        }

        // Discord timeout limit is 28 days
        if (milliseconds > 28 * 24 * 60 * 60 * 1000) {
            return interaction.reply({ content: '⚠️ Maximum mute duration is 28 days.', ephemeral: true });
        }

        try {
            await member.timeout(milliseconds, reason);
            return interaction.reply(`🔇 **${member.user.tag}** has been muted.\n⏱ **Duration:** ${durationString}\n📝 **Reason:** ${reason}`);
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Failed to mute the member due to an error.', ephemeral: true });
        }
    },
};
