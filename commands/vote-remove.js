const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('vote-remove').setDescription('Delete a poll message.').addStringOption(o=>o.setName('id').setDescription('Poll message ID').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(i) {
        await i.deferReply({ ephemeral: true });
        const id = i.options.getString('id');
        try {
            const m = await i.channel.messages.fetch(id);
            await m.delete();
            await i.editReply('🗑️ Poll has been removed.');
        } catch {
            await i.editReply('❌ **Error:** Message not found.');
        }
    }
};
