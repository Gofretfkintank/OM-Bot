const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('🔇 Mute a member using Discord timeout.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('👤 Member to mute')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('⏱ Duration in minutes')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('📝 Reason for mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const member = interaction.options.getMember('target');
        const minutes = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!member)
            return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

        if (member.id === interaction.user.id)
            return interaction.reply({ content: '⚠️ You cannot mute yourself.', ephemeral: true });

        if (!member.moderatable)
            return interaction.reply({ content: '❌ I cannot mute this member.', ephemeral: true });

        const milliseconds = minutes * 60 * 1000;

        try {
            await member.timeout(milliseconds, reason);
            return interaction.reply(`🔇 ${member.user.tag} has been muted for ⏱ **${minutes} minute(s)**\n📝 Reason: ${reason}`);
        } catch (err) {
            return interaction.reply({ content: '❌ Failed to mute the member.', ephemeral: true });
        }
    },
};