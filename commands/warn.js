const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../models/Warn');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a warning')
        .addUserOption(opt =>
            opt.setName('user').setDescription('User').setRequired(true))
        .addStringOption(opt =>
            opt.setName('reason').setDescription('Reason').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const user   = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        let data = await Warn.findOne({ userId: user.id, guildId: interaction.guildId });
        if (!data) data = new Warn({ userId: user.id, guildId: interaction.guildId, warns: [] });
        data.warns.push({ reason, moderator: interaction.user.tag, date: new Date().toLocaleDateString() });
        await data.save();
        await interaction.editReply(`⚠️ ${user.tag} warned. Reason: ${reason}`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply('❌ You need **Moderate Members** permission.');
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `warn @user <reason>`');
        const reason = args.slice(1).join(' ');
        if (!reason) return message.reply('❌ Please provide a reason.');
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply('❌ User not found.');
        let data = await Warn.findOne({ userId: user.id, guildId: message.guildId });
        if (!data) data = new Warn({ userId: user.id, guildId: message.guildId, warns: [] });
        data.warns.push({ reason, moderator: message.author.tag, date: new Date().toLocaleDateString() });
        await data.save();
        return message.reply(`⚠️ **${user.tag}** warned. Reason: ${reason}`);
    }
};
