const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unto')
        .setDescription('Quickly remove a timeout from a member.')
        .addUserOption(o => o.setName('user').setDescription('The user to unmute quickly').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        await member.timeout(null);
        await interaction.editReply({ embeds: [
            ok(`🔊 **${member.user.tag}** is back in the conversation! ✅`)
                .setFooter({ text: `Unmuted by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply({ embeds: [err('❌ You need **Moderate Members** permission.')] });
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply({ embeds: [err('❌ Usage: `unto @user`')] });
        const target = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply({ embeds: [err('❌ Member not found.')] });
        await target.timeout(null);
        return message.reply({ embeds: [
            ok(`🔊 **${target.user.tag}** is back in the conversation! ✅`)
                .setFooter({ text: `Unmuted by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
