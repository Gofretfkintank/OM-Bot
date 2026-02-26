const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('ban').setDescription('Ban a member from the server.').addUserOption(o => o.setName('target').setDescription('Member to ban').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for the ban')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(i) {
        await i.deferReply();
        const u = i.options.getMember('target');
        const r = i.options.getString('reason') || 'No reason provided';
        if (!u.bannable) return i.editReply('❌ **Error:** I cannot ban this user due to role hierarchy.');
        await u.ban({ reason: r });
        await i.editReply(`🔨 **${u.user.tag}** has been banned. Reason: ${r}`);
    }
};
