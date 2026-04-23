const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../models/Warn');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-warning')
        .setDescription('Clear all warnings')
        .addUserOption(opt =>
            opt.setName('user').setDescription('User').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        const user   = interaction.options.getUser('user');
        const result = await Warn.deleteMany({ userId: user.id, guildId: interaction.guildId });
        if (result.deletedCount === 0) return interaction.editReply('❌ No warnings found.');
        await interaction.editReply(`🧹 Cleared ${result.deletedCount} warnings for ${user.tag}`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
            return message.reply('❌ You need **Administrator** permission.');
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `clearwarnings @user`');
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply('❌ User not found.');
        const result = await Warn.deleteMany({ userId: user.id, guildId: message.guildId });
        if (result.deletedCount === 0) return message.reply(`❌ No warnings found for **${user.tag}**.`);
        return message.reply(`🧹 Cleared **${result.deletedCount}** warning(s) for **${user.tag}**.`);
    }
};
