const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription("Remove a user's ban.")
        .addStringOption(o => o.setName('id').setDescription('The ID of the user to unban').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const userId = interaction.options.getString('id');
        try {
            await interaction.guild.members.unban(userId);
            await interaction.editReply({ embeds: [
                ok(`✅ User \`${userId}\` has been unbanned.`)
                    .setFooter({ text: `Unbanned by ${interaction.user.tag}` })
                    .setTimestamp()
            ]});
        } catch {
            await interaction.editReply({ embeds: [err('❌ Invalid ID or user is not banned.')] });
        }
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
            return message.reply({ embeds: [err('❌ You need **Ban Members** permission.')] });
        const userId = args[0];
        if (!userId) return message.reply({ embeds: [err('❌ Usage: `unban <user_id>`')] });
        try {
            await message.guild.members.unban(userId);
            return message.reply({ embeds: [
                ok(`✅ User \`${userId}\` has been unbanned.`)
                    .setFooter({ text: `Unbanned by ${message.author.tag}` })
                    .setTimestamp()
            ]});
        } catch {
            return message.reply({ embeds: [err('❌ Invalid ID or user is not banned.')] });
        }
    }
};
