const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
module.exports = {
    data: new SlashCommandBuilder().setName('warn').setDescription('Issue a warning.').addUserOption(o=>o.setName('user').setDescription('User to warn').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Reason for warning').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
        await i.deferReply();
        const u = i.options.getUser('user');
        const r = i.options.getString('reason');
        let d = JSON.parse(fs.readFileSync('./warns.json', 'utf8') || '{}');
        if(!d[u.id]) d[u.id] = [];
        d[u.id].push({ reason: r, moderator: i.user.tag, date: new Date().toLocaleDateString() });
        fs.writeFileSync('./warns.json', JSON.stringify(d, null, 2));
        await i.editReply(`⚠️ **${u.tag}** has been warned. Reason: **${r}**`);
    }
};
