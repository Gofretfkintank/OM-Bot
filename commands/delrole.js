const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delrole')
        .setDescription('Delete an existing role from the server.')
        .addRoleOption(o => o.setName('role').setDescription('The role to delete').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        const role = interaction.options.getRole('role');
        const name = role.name;
        await role.delete();
        await interaction.editReply({ embeds: [
            ok(`🗑️ Role **${name}** has been deleted.`)
                .setFooter({ text: `Deleted by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
            return message.reply({ embeds: [err('❌ You need **Manage Roles** permission.')] });
        const id = args[0]?.replace(/[<@&>]/g, '');
        if (!id) return message.reply({ embeds: [err('❌ Usage: `delrole @role`')] });
        const role = await message.guild.roles.fetch(id).catch(() => null);
        if (!role) return message.reply({ embeds: [err('❌ Role not found.')] });
        const name = role.name;
        await role.delete();
        return message.reply({ embeds: [
            ok(`🗑️ Role **${name}** has been deleted.`)
                .setFooter({ text: `Deleted by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
