const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give-role')
        .setDescription('Assign a role to a member.')
        .addUserOption(o => o.setName('user').setDescription('The user to receive the role').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('The role to give').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        const member = interaction.options.getMember('user');
        const role   = interaction.options.getRole('role');
        await member.roles.add(role);
        await interaction.editReply({ embeds: [
            ok(`✅ **${role.name}** has been assigned to **${member.user.tag}**.`)
                .setFooter({ text: `Assigned by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
            return message.reply({ embeds: [err('❌ You need **Manage Roles** permission.')] });
        const memberId = args[0]?.replace(/[<@!>]/g, '');
        const roleId   = args[1]?.replace(/[<@&>]/g, '');
        if (!memberId || !roleId) return message.reply({ embeds: [err('❌ Usage: `giverole @user @role`')] });
        const target = await message.guild.members.fetch(memberId).catch(() => null);
        const role   = await message.guild.roles.fetch(roleId).catch(() => null);
        if (!target || !role) return message.reply({ embeds: [err('❌ Member or role not found.')] });
        await target.roles.add(role);
        return message.reply({ embeds: [
            ok(`✅ **${role.name}** has been assigned to **${target.user.tag}**.`)
                .setFooter({ text: `Assigned by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
