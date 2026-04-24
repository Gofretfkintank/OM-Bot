const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nick')
        .setDescription("Change a member's nickname.")
        .addUserOption(o => o.setName('user').setDescription('The member to rename').setRequired(true))
        .addStringOption(o => o.setName('name').setDescription('The new nickname').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        await interaction.deferReply();
        const member  = interaction.options.getMember('user');
        const newName = interaction.options.getString('name');
        await member.setNickname(newName);
        await interaction.editReply({ embeds: [
            ok(`📝 Nickname for **${member.user.tag}** changed to **${newName}**.`)
                .setFooter({ text: `Changed by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames))
            return message.reply({ embeds: [err('❌ You need **Manage Nicknames** permission.')] });
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply({ embeds: [err('❌ Usage: `nick @user <new name>`')] });
        const target  = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply({ embeds: [err('❌ Member not found.')] });
        const newNick = args.slice(1).join(' ');
        if (!newNick) return message.reply({ embeds: [err('❌ Usage: `nick @user <new name>`')] });
        await target.setNickname(newNick);
        return message.reply({ embeds: [
            ok(`📝 Nickname for **${target.user.tag}** changed to **${newNick}**.`)
                .setFooter({ text: `Changed by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
