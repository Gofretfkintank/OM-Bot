const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

function parseDuration(str) {
    const regex = /(\d+)([smhd])/g;
    let totalMs = 0, match, found = false;
    while ((match = regex.exec(str)) !== null) {
        found = true;
        const v = parseInt(match[1]);
        switch (match[2]) {
            case 's': totalMs += v * 1000; break;
            case 'm': totalMs += v * 60 * 1000; break;
            case 'h': totalMs += v * 60 * 60 * 1000; break;
            case 'd': totalMs += v * 24 * 60 * 60 * 1000; break;
        }
    }
    return found ? totalMs : null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a member using Discord timeout.')
        .addUserOption(option =>
            option.setName('target').setDescription('Member to mute').setRequired(true))
        .addStringOption(option =>
            option.setName('duration').setDescription('Duration (10m, 1h, 1d)').setRequired(true))
        .addStringOption(option =>
            option.setName('reason').setDescription('Reason').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        if (!interaction.guild) return interaction.reply({ content: 'Server only command.', ephemeral: true });

        const targetUser = interaction.options.getUser('target');
        let member;
        try {
            member = await interaction.guild.members.fetch(targetUser.id);
        } catch {
            return interaction.reply({ content: 'Member could not be found in this server.', ephemeral: true });
        }

        const durationString = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (member.id === interaction.user.id)
            return interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });
        if (!member.moderatable)
            return interaction.reply({ content: 'I cannot mute this member. Role position issue.', ephemeral: true });

        const ms = parseDuration(durationString);
        if (!ms) return interaction.reply({ content: 'Invalid duration format. Example: 10m, 1h, 1d', ephemeral: true });

        try {
            await member.timeout(ms, reason);
            return interaction.reply(`🔇 ${member.user.tag} muted for ${durationString}`);
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Timeout failed. Check permissions.', ephemeral: true });
        }
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply('❌ You need **Moderate Members** permission.');

        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id || !args[1]) return message.reply('❌ Usage: `mute @user <10m/1h/1d> [reason]`');

        const target = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply('❌ Member not found in this server.');
        if (!target.moderatable) return message.reply('❌ I cannot mute this member (role hierarchy).');
        if (target.id === message.author.id) return message.reply('❌ You cannot mute yourself.');

        const ms = parseDuration(args[1]);
        if (!ms) return message.reply('❌ Invalid duration. Examples: `10m`, `1h`, `2d`');

        const reason = args.slice(2).join(' ') || 'No reason provided';
        try {
            await target.timeout(ms, reason);
            return message.reply(`🔇 **${target.user.tag}** muted for **${args[1]}**. Reason: ${reason}`);
        } catch {
            return message.reply('❌ Timeout failed. Check permissions.');
        }
    }
};
