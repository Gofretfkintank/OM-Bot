const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove timeout from a member.')
        .addUserOption(option => 
            option.setName('user').setDescription('The user to unmute').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        await member.timeout(null);
        await interaction.editReply(`🔊 Timeout removed for **${member.user.tag}**.`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply('❌ You need **Moderate Members** permission.');
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `unmute @user`');
        const target = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply('❌ Member not found.');
        await target.timeout(null);
        return message.reply(`🔊 Timeout removed for **${target.user.tag}**.`);
    }
};
