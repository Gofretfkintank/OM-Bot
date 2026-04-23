const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unto')
        .setDescription('Quickly remove a timeout from a member.')
        .addUserOption(option => 
            option.setName('user').setDescription('The user to unmute quickly').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        await member.timeout(null);
        await interaction.editReply(`🔊 **${member.user.tag}** is back in the conversation! ✅`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return message.reply('❌ You need **Moderate Members** permission.');
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `unto @user`');
        const target = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply('❌ Member not found.');
        await target.timeout(null);
        return message.reply(`🔊 **${target.user.tag}** is back in the conversation! ✅`);
    }
};
