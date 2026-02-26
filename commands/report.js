const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('report').setDescription('Report a user to staff.').addUserOption(o=>o.setName('user').setRequired(true)).addStringOption(o=>o.setName('reason').setRequired(true)),
    async execute(i) {
        await i.deferReply({ ephemeral: true });
        const u = i.options.getUser('user');
        const r = i.options.getString('reason');
        const logChannel = i.guild.channels.cache.get(process.env.REPORT_LOG_ID);
        if(!logChannel) return i.editReply('❌ **Error:** Report log channel not found.');
        const embed = new EmbedBuilder().setTitle('📩 New Report').addFields({name:'Reporter', value:i.user.tag}, {name:'Target', value:u.tag}, {name:'Reason', value:r}).setColor('Red').setTimestamp();
        await logChannel.send({ embeds: [embed] });
        await i.editReply('✅ Your report has been submitted to staff.');
    }
};
