const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../models/Warn');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Check warnings')
        .addUserOption(opt =>
            opt.setName('user').setDescription('User').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('user');
        const data = await Warn.findOne({ userId: user.id, guildId: interaction.guildId });
        if (!data || data.warns.length === 0) return interaction.editReply('No warnings.');
        const history = data.warns.map((w, i) => `${i + 1}. ${w.reason} (By: ${w.moderator})`).join('\n');
        await interaction.editReply(`📋 ${user.tag} warnings:\n${history}`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply('❌ You need **Moderate Members** permission.');
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `warnings @user`');
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply('❌ User not found.');
        const data = await Warn.findOne({ userId: user.id, guildId: message.guildId });
        if (!data || data.warns.length === 0) return message.reply(`✅ **${user.tag}** has no warnings.`);
        const history = data.warns.map((w, i) => `${i + 1}. ${w.reason} *(by ${w.moderator})*`).join('\n');
        return message.reply(`📋 **${user.tag}** warnings:\n${history}`);
    }
};
