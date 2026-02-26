const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
module.exports = {
    data: new SlashCommandBuilder().setName('warnings').setDescription('Check user warning history.').addUserOption(o=>o.setName('user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
        await i.deferReply();
        const u = i.options.getUser('user');
        let d = JSON.parse(fs.readFileSync('./warns.json', 'utf8') || '{}');
        const list = d[u.id]?.map((w, idx) => `\`${idx+1}.\` **Reason:** ${w.reason} (By: ${w.moderator})`).join('\n') || 'This user is clean! ✅';
        await i.editReply(`📋 **Warning History for ${u.tag}:**\n${list}`);
    }
};
