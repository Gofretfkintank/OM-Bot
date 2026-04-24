const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editrole')
        .setDescription('Rename an existing role.')
        .addRoleOption(o => o.setName('role').setDescription('The role to rename').setRequired(true))
        .addStringOption(o => o.setName('name').setDescription('The new name for the role').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        const role    = interaction.options.getRole('role');
        const newName = interaction.options.getString('name');
        await role.setName(newName);
        await interaction.editReply({ embeds: [
            ok(`✏️ Role renamed to **${newName}**.`)
                .setFooter({ text: `Edited by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
            return message.reply({ embeds: [err('❌ You need **Manage Roles** permission.')] });
        const id = args[0]?.replace(/[<@&>]/g, '');
        if (!id) return message.reply({ embeds: [err('❌ Usage: `editrole @role <new name>`')] });
        const role = await message.guild.roles.fetch(id).catch(() => null);
        if (!role) return message.reply({ embeds: [err('❌ Role not found.')] });
        const newName = args.slice(1).join(' ');
        if (!newName) return message.reply({ embeds: [err('❌ Usage: `editrole @role <new name>`')] });
        await role.setName(newName);
        return message.reply({ embeds: [
            ok(`✏️ Role renamed to **${newName}**.`)
                .setFooter({ text: `Edited by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
