const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warn = require('../models/Warn');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a warning to a member.')
        .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const user   = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        let data = await Warn.findOne({ userId: user.id, guildId: interaction.guildId });
        if (!data) data = new Warn({ userId: user.id, guildId: interaction.guildId, warns: [] });
        data.warns.push({ reason, moderator: interaction.user.tag, date: new Date().toLocaleDateString() });
        await data.save();
        await interaction.editReply({ embeds: [
            ok(`⚠️ **${user.tag}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${data.warns.length}`)
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: `Warned by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply({ embeds: [err('❌ You need **Moderate Members** permission.')] });
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply({ embeds: [err('❌ Usage: `warn @user <reason>`')] });
        const reason = args.slice(1).join(' ');
        if (!reason) return message.reply({ embeds: [err('❌ Please provide a reason.')] });
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply({ embeds: [err('❌ User not found.')] });
        let data = await Warn.findOne({ userId: user.id, guildId: message.guildId });
        if (!data) data = new Warn({ userId: user.id, guildId: message.guildId, warns: [] });
        data.warns.push({ reason, moderator: message.author.tag, date: new Date().toLocaleDateString() });
        await data.save();
        return message.reply({ embeds: [
            ok(`⚠️ **${user.tag}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${data.warns.length}`)
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: `Warned by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
