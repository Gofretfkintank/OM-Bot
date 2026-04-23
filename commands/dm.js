const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message through the bot.')
        .addUserOption(option => 
            option.setName('user').setDescription('The user to message').setRequired(true))
        .addStringOption(option => 
            option.setName('msg').setDescription('The content of the message').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const user    = interaction.options.getUser('user');
        const message = interaction.options.getString('msg');
        try {
            await user.send(`📩 **Direct Message from ${interaction.guild.name}:**\n${message}`);
            await interaction.editReply(`✅ **Success:** DM sent to **${user.tag}**.`);
        } catch (error) {
            await interaction.editReply('❌ **Failed:** This user has their DMs closed.');
        }
    },

    async prefix(message, args) {
        const { PermissionFlagsBits } = require('discord.js');
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return message.reply('❌ You need **Manage Messages** permission.');
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `dm @user <message>`');
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply('❌ User not found.');
        const msg = args.slice(1).join(' ');
        if (!msg) return message.reply('❌ Usage: `dm @user <message>`');
        try {
            await user.send(`📩 **Direct Message from ${message.guild.name}:**\n${msg}`);
            return message.reply(`✅ DM sent to **${user.tag}**.`);
        } catch {
            return message.reply('❌ This user has their DMs closed.');
        }
    }
};
