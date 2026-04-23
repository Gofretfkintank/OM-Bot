const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('take-role')
        .setDescription('Remove a role from a member.')
        .addUserOption(option => 
            option.setName('user').setDescription('The user to remove the role from').setRequired(true))
        .addRoleOption(option => 
            option.setName('role').setDescription('The role to take back').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        const role   = interaction.options.getRole('role');
        await member.roles.remove(role);
        await interaction.editReply(`❌ **Success:** **${role.name}** has been removed from **${member.user.tag}**. 🎭`);
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
            return message.reply('❌ You need **Manage Roles** permission.');
        const memberId = args[0]?.replace(/[<@!>]/g, '');
        const roleId   = args[1]?.replace(/[<@&>]/g, '');
        if (!memberId || !roleId) return message.reply('❌ Usage: `takerole @user @role`');
        const target = await message.guild.members.fetch(memberId).catch(() => null);
        const role   = await message.guild.roles.fetch(roleId).catch(() => null);
        if (!target || !role) return message.reply('❌ Member or role not found.');
        await target.roles.remove(role);
        return message.reply(`❌ **${role.name}** removed from **${target.user.tag}**.`);
    }
};
