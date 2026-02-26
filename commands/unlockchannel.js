const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('unlockchannel').setDescription('Unlock the channel for everyone.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(i) {
        await i.deferReply();
        await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: true });
        await i.editReply('🔓 **Channel Unlocked!** Everyone can speak now. 🗣️');
    }
};
