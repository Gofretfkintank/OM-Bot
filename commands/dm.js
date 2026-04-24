const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message through the bot.')
        .addUserOption(o => o.setName('user').setDescription('The user to message').setRequired(true))
        .addStringOption(o => o.setName('msg').setDescription('The content of the message').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const user = interaction.options.getUser('user');
        const msg  = interaction.options.getString('msg');
        try {
            await user.send(`📩 **Direct Message from ${interaction.guild.name}:**\n${msg}`);
            await interaction.editReply({ embeds: [
                ok(`✅ DM sent to **${user.tag}**.`)
                    .setTimestamp()
            ]});
        } catch {
            await interaction.editReply({ embeds: [err('❌ This user has their DMs closed.')] });
        }
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return message.reply({ embeds: [err('❌ You need **Manage Messages** permission.')] });
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply({ embeds: [err('❌ Usage: `dm @user <message>`')] });
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply({ embeds: [err('❌ User not found.')] });
        const msg = args.slice(1).join(' ');
        if (!msg) return message.reply({ embeds: [err('❌ Usage: `dm @user <message>`')] });
        try {
            await user.send(`📩 **Direct Message from ${message.guild.name}:**\n${msg}`);
            return message.reply({ embeds: [ok(`✅ DM sent to **${user.tag}**.`).setTimestamp()] });
        } catch {
            return message.reply({ embeds: [err('❌ This user has their DMs closed.')] });
        }
    }
};
