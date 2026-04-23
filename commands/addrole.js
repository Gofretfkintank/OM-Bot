const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Create a new role in the server.')
        .addStringOption(option => 
            option.setName('name').setDescription('The name of the new role').setRequired(true))
        .addStringOption(option => 
            option.setName('color').setDescription('Hex color code (e.g., #ff0000)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        const name  = interaction.options.getString('name');
        const color = interaction.options.getString('color') || '#ffffff';
        await interaction.guild.roles.create({ name, color });
        await interaction.editReply(`✅ **Success:** New role **${name}** has been created! 🎨`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
            return message.reply('❌ You need **Manage Roles** permission.');
        const name = args[0];
        if (!name) return message.reply('❌ Usage: `addrole <name> [#color]`');
        const color = args[1] || '#ffffff';
        await message.guild.roles.create({ name, color });
        return message.reply(`✅ Role **${name}** created.`);
    }
};
