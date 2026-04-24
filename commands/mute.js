const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

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
        .addUserOption(o => o.setName('target').setDescription('Member to mute').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h, 1d').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const targetUser   = interaction.options.getUser('target');
        const durationStr  = interaction.options.getString('duration');
        const reason       = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.reply({ embeds: [err('❌ Member not found in this server.')], ephemeral: true });
        if (member.id === interaction.user.id) return interaction.reply({ embeds: [err('❌ You cannot mute yourself.')], ephemeral: true });
        if (!member.moderatable) return interaction.reply({ embeds: [err('❌ I cannot mute this member (role hierarchy).')], ephemeral: true });
        const ms = parseDuration(durationStr);
        if (!ms) return interaction.reply({ embeds: [err('❌ Invalid duration. Examples: `10m`, `1h`, `2d`')], ephemeral: true });
        try {
            await member.timeout(ms, reason);
            await interaction.reply({ embeds: [
                ok(`🔇 **${targetUser.tag}** has been muted for **${durationStr}**.\n**Reason:** ${reason}`)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setFooter({ text: `Muted by ${interaction.user.tag}` })
                    .setTimestamp()
            ]});
        } catch {
            await interaction.reply({ embeds: [err('❌ Timeout failed. Check permissions.')], ephemeral: true });
        }
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply({ embeds: [err('❌ You need **Moderate Members** permission.')] });
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id || !args[1]) return message.reply({ embeds: [err('❌ Usage: `mute @user <10m/1h/1d> [reason]`')] });
        const target = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply({ embeds: [err('❌ Member not found.')] });
        if (!target.moderatable) return message.reply({ embeds: [err('❌ I cannot mute this member (role hierarchy).')] });
        if (target.id === message.author.id) return message.reply({ embeds: [err('❌ You cannot mute yourself.')] });
        const ms = parseDuration(args[1]);
        if (!ms) return message.reply({ embeds: [err('❌ Invalid duration. Examples: `10m`, `1h`, `2d`')] });
        const reason = args.slice(2).join(' ') || 'No reason provided';
        try {
            await target.timeout(ms, reason);
            return message.reply({ embeds: [
                ok(`🔇 **${target.user.tag}** has been muted for **${args[1]}**.\n**Reason:** ${reason}`)
                    .setThumbnail(target.user.displayAvatarURL())
                    .setFooter({ text: `Muted by ${message.author.tag}` })
                    .setTimestamp()
            ]});
        } catch {
            return message.reply({ embeds: [err('❌ Timeout failed. Check permissions.')] });
        }
    }
};
