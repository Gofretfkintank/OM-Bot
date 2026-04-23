const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nick')
        .setDescription('Change a member\'s nickname.')
        .addUserOption(option => 
            option.setName('user').setDescription('The member to rename').setRequired(true))
        .addStringOption(option => 
            option.setName('name').setDescription('The new nickname').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        await interaction.deferReply();
        const member  = interaction.options.getMember('user');
        const newName = interaction.options.getString('name');
        await member.setNickname(newName);
        await interaction.editReply(`📝 **Success:** Nickname for **${member.user.tag}** changed to **${newName}**.`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames))
            return message.reply('❌ You need **Manage Nicknames** permission.');
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `nick @user <new name>`');
        const target  = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply('❌ Member not found.');
        const newNick = args.slice(1).join(' ');
        if (!newNick) return message.reply('❌ Usage: `nick @user <new name>`');
        await target.setNickname(newNick);
        return message.reply(`📝 Nickname for **${target.user.tag}** changed to **${newNick}**.`);
    }
};
