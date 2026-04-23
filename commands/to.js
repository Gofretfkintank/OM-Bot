const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('to')
        .setDescription('Quick 10-minute timeout for a member.')
        .addUserOption(option => 
            option.setName('user').setDescription('The user to silence for 10 minutes').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        await member.timeout(600000);
        await interaction.editReply(`🔇 **${member.user.tag}** has been silenced for 10 minutes. ⚡`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply('❌ You need **Moderate Members** permission.');
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `to @user`');
        const target = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply('❌ Member not found.');
        await target.timeout(600_000);
        return message.reply(`🔇 **${target.user.tag}** has been silenced for 10 minutes. ⚡`);
    }
};
