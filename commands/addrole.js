const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Create a new role in the server.')
        .addStringOption(o => o.setName('name').setDescription('Name of the new role').setRequired(true))
        .addStringOption(o => o.setName('color').setDescription('Hex color code e.g. #ff0000'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();
        const name  = interaction.options.getString('name');
        const color = interaction.options.getString('color') || '#ffffff';
        await interaction.guild.roles.create({ name, color });
        await interaction.editReply({ embeds: [
            ok(`✅ Role **${name}** has been created.`)
                .setFooter({ text: `Created by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles))
            return message.reply({ embeds: [err('❌ You need **Manage Roles** permission.')] });
        const name = args[0];
        if (!name) return message.reply({ embeds: [err('❌ Usage: `addrole <n> [#color]`')] });
        const color = args[1] || '#ffffff';
        await message.guild.roles.create({ name, color });
        return message.reply({ embeds: [
            ok(`✅ Role **${name}** has been created.`)
                .setFooter({ text: `Created by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
