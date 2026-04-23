const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delrole')
        .setDescription('Delete an existing role from the server.')
        .addRoleOption(option => 
            option.setName('role').setDescription('The role to delete').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        const role = interaction.options.getRole('role');
        await role.delete();
        await interaction.editReply(`🗑️ **Success:** The role has been successfully deleted.`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
            return message.reply('❌ You need **Manage Roles** permission.');
        const id = args[0]?.replace(/[<@&>]/g, '');
        if (!id) return message.reply('❌ Usage: `delrole @role`');
        const role = await message.guild.roles.fetch(id).catch(() => null);
        if (!role) return message.reply('❌ Role not found.');
        const roleName = role.name;
        await role.delete();
        return message.reply(`🗑️ Role **${roleName}** deleted.`);
    }
};
