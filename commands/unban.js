const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Remove a user\'s ban.')
        .addStringOption(option => 
            option.setName('id')
                .setDescription('The ID of the user to unban')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const userId = interaction.options.getString('id');
        try {
            await interaction.guild.members.unban(userId);
            await interaction.editReply(`✅ **Success:** User with ID \`${userId}\` has been unbanned.`);
        } catch (error) {
            await interaction.editReply('❌ **Error:** Please provide a valid banned user ID.');
        }
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
            return message.reply('❌ You need **Ban Members** permission.');
        const userId = args[0];
        if (!userId) return message.reply('❌ Usage: `unban <user_id>`');
        try {
            await message.guild.members.unban(userId);
            return message.reply(`✅ User \`${userId}\` has been unbanned.`);
        } catch {
            return message.reply('❌ Invalid ID or user is not banned.');
        }
    }
};
