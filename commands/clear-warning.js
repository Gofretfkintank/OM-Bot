const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
module.exports = {
    data: new SlashCommandBuilder().setName('clear-warning').setDescription('Clear all warnings for a user.').addUserOption(o=>o.setName('user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(i) {
        await i.deferReply();
        const u = i.options.getUser('user');
        let d = JSON.parse(fs.readFileSync('./warns.json', 'utf8') || '{}');
        delete d[u.id];
        fs.writeFileSync('./warns.json', JSON.stringify(d, null, 2));
        await i.editReply(`✅ All warnings cleared for **${u.tag}**. Records updated! ♻️`);
    }
};
