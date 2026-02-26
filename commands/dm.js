const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('dm').setDescription('Send a direct message through the bot.').addUserOption(o=>o.setName('user').setRequired(true)).addStringOption(o=>o.setName('msg').setRequired(true)),
    async execute(i) {
        await i.deferReply({ ephemeral: true });
        const u = i.options.getUser('user');
        const m = i.options.getString('msg');
        try {
            await u.send(`📩 **Message from ${i.guild.name}:**\n${m}`);
            await i.editReply(`✅ DM sent to **${u.tag}**.`);
        } catch {
            await i.editReply('❌ **Failed:** User has DMs closed.');
        }
    }
};
