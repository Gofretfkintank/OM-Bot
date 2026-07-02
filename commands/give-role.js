const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

// Returns a human-readable error string if this role can't be managed, else null.
// Guards against: user not in guild, @everyone, integration roles, missing bot
// permission, bot role hierarchy, and executor hierarchy abuse.
function roleBlocker(guild, executorMember, targetMember, role) {
    const me = guild.members.me;
    if (!targetMember)
        return '❌ That user is not in this server.';
    if (role.id === guild.id)
        return '❌ You can\'t assign **@everyone** as a role.';
    if (role.managed)
        return '❌ That role belongs to a bot/integration and can\'t be assigned manually.';
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles))
        return '❌ I don\'t have **Manage Roles** permission in this server.';
    if (role.position >= me.roles.highest.position)
        return `❌ **${role.name}** is above (or equal to) my highest role. Move my role higher in Server Settings → Roles.`;
    if (guild.ownerId !== executorMember.id && role.position >= executorMember.roles.highest.position)
        return `❌ You can't manage **${role.name}** — it's not below your own highest role.`;
    return null;
}

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

        const blocked = roleBlocker(interaction.guild, interaction.member, member, role);
        if (blocked) return interaction.editReply({ embeds: [err(blocked)] });

        if (member.roles.cache.has(role.id))
            return interaction.editReply({ embeds: [err(`❌ **${member.user.tag}** already has **${role.name}**.`)] });

        try {
            await member.roles.add(role);
            await interaction.editReply({ embeds: [
                ok(`✅ **${role.name}** has been assigned to **${member.user.tag}**.`)
                    .setFooter({ text: `Assigned by ${interaction.user.tag}` })
                    .setTimestamp()
            ]});
        } catch (e) {
            console.error('[GIVE-ROLE]', e.message);
            await interaction.editReply({ embeds: [err('❌ Discord refused the role change. Check my permissions and role position.')] });
        }
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

        const blocked = roleBlocker(message.guild, message.member, target, role);
        if (blocked) return message.reply({ embeds: [err(blocked)] });

        if (target.roles.cache.has(role.id))
            return message.reply({ embeds: [err(`❌ **${target.user.tag}** already has **${role.name}**.`)] });

        try {
            await target.roles.add(role);
            return message.reply({ embeds: [
                ok(`✅ **${role.name}** has been assigned to **${target.user.tag}**.`)
                    .setFooter({ text: `Assigned by ${message.author.tag}` })
                    .setTimestamp()
            ]});
        } catch (e) {
            console.error('[GIVE-ROLE]', e.message);
            return message.reply({ embeds: [err('❌ Discord refused the role change. Check my permissions and role position.')] });
        }
    }
};
