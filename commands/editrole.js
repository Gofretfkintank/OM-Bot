const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editrole')
        .setDescription('Rename an existing role.')
        .addRoleOption(option => 
            option.setName('role').setDescription('The role to rename').setRequired(true))
        .addStringOption(option => 
            option.setName('name').setDescription('The new name for the role').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        const role    = interaction.options.getRole('role');
        const newName = interaction.options.getString('name');
        await role.setName(newName);
        await interaction.editReply(`✏️ **Success:** Role name has been updated to **${newName}**.`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
            return message.reply('❌ You need **Manage Roles** permission.');
        const id = args[0]?.replace(/[<@&>]/g, '');
        if (!id) return message.reply('❌ Usage: `editrole @role <new name>`');
        const role = await message.guild.roles.fetch(id).catch(() => null);
        if (!role) return message.reply('❌ Role not found.');
        const newName = args.slice(1).join(' ');
        if (!newName) return message.reply('❌ Usage: `editrole @role <new name>`');
        await role.setName(newName);
        return message.reply(`✏️ Role renamed to **${newName}**.`);
    }
};
