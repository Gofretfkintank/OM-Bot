const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('addrole').setDescription('Create a new role.').addStringOption(o=>o.setName('name').setRequired(true)).addStringOption(o=>o.setName('color').setDescription('Hex color code (e.g., #ff0000)')).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(i) {
        await i.deferReply();
        const n = i.options.getString('name');
        const c = i.options.getString('color') || '#ffffff';
        await i.guild.roles.create({ name: n, color: c });
        await i.editReply(`✨ New role **${n}** has been created! 🎨`);
    }
};
