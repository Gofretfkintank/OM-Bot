const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set channel slowmode (ratelimit).')
        .addIntegerOption(o => o.setName('sec').setDescription('Slowmode duration in seconds').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply();
        const seconds = interaction.options.getInteger('sec');
        await interaction.channel.setRateLimitPerUser(seconds);
        await interaction.editReply({ embeds: [
            ok(seconds === 0 ? '🚀 **Slowmode disabled.**' : `🐢 **Slowmode set to ${seconds} seconds.**`)
                .setFooter({ text: `Set by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
            return message.reply({ embeds: [err('❌ You need **Manage Channels** permission.')] });
        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0)
            return message.reply({ embeds: [err('❌ Usage: `slowmode <seconds>`')] });
        await message.channel.setRateLimitPerUser(seconds);
        return message.reply({ embeds: [
            ok(seconds === 0 ? '🚀 **Slowmode disabled.**' : `🐢 **Slowmode set to ${seconds} seconds.**`)
                .setFooter({ text: `Set by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
