const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warn = require('../models/Warn');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-warning')
        .setDescription('Clear all warnings for a member.')
        .addUserOption(o => o.setName('user').setDescription('User to clear warnings for').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        const user   = interaction.options.getUser('user');
        const result = await Warn.deleteMany({ userId: user.id, guildId: interaction.guildId });
        if (result.deletedCount === 0)
            return interaction.editReply({ embeds: [err(`❌ No warnings found for **${user.tag}**.`)] });
        await interaction.editReply({ embeds: [
            ok(`🧹 Cleared **${result.deletedCount}** warning(s) for **${user.tag}**.`)
                .setFooter({ text: `Cleared by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
            return message.reply({ embeds: [err('❌ You need **Administrator** permission.')] });
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply({ embeds: [err('❌ Usage: `clearwarnings @user`')] });
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply({ embeds: [err('❌ User not found.')] });
        const result = await Warn.deleteMany({ userId: user.id, guildId: message.guildId });
        if (result.deletedCount === 0)
            return message.reply({ embeds: [err(`❌ No warnings found for **${user.tag}**.`)] });
        return message.reply({ embeds: [
            ok(`🧹 Cleared **${result.deletedCount}** warning(s) for **${user.tag}**.`)
                .setFooter({ text: `Cleared by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
