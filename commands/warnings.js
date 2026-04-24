const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warn = require('../models/Warn');

function ok(embed) { return embed.setColor(0x2ecc71); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Check warnings for a member.')
        .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('user');
        const data = await Warn.findOne({ userId: user.id, guildId: interaction.guildId });
        if (!data || data.warns.length === 0) {
            return interaction.editReply({ embeds: [
                new EmbedBuilder().setColor(0x2ecc71)
                    .setDescription(`✅ **${user.tag}** has no warnings.`)
                    .setThumbnail(user.displayAvatarURL())
            ]});
        }
        const history = data.warns.map((w, i) => `**${i + 1}.** ${w.reason}\n┗ *by ${w.moderator} · ${w.date}*`).join('\n\n');
        await interaction.editReply({ embeds: [
            ok(new EmbedBuilder()
                .setTitle(`⚠️ Warnings for ${user.tag}`)
                .setDescription(history)
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: `Total: ${data.warns.length} warning(s)` })
                .setTimestamp()
            )
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply({ embeds: [err('❌ You need **Moderate Members** permission.')] });
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply({ embeds: [err('❌ Usage: `warnings @user`')] });
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply({ embeds: [err('❌ User not found.')] });
        const data = await Warn.findOne({ userId: user.id, guildId: message.guildId });
        if (!data || data.warns.length === 0) {
            return message.reply({ embeds: [
                new EmbedBuilder().setColor(0x2ecc71)
                    .setDescription(`✅ **${user.tag}** has no warnings.`)
                    .setThumbnail(user.displayAvatarURL())
            ]});
        }
        const history = data.warns.map((w, i) => `**${i + 1}.** ${w.reason}\n┗ *by ${w.moderator} · ${w.date}*`).join('\n\n');
        return message.reply({ embeds: [
            ok(new EmbedBuilder()
                .setTitle(`⚠️ Warnings for ${user.tag}`)
                .setDescription(history)
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: `Total: ${data.warns.length} warning(s)` })
                .setTimestamp()
            )
        ]});
    }
};
