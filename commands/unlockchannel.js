const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

async function unlockChannel(channel, guild) {
    const nonStaff = guild.roles.cache.filter(r =>
        !r.permissions.has(PermissionFlagsBits.ManageMessages) &&
        !r.permissions.has(PermissionFlagsBits.Administrator) &&
        r.name !== '@everyone'
    );
    for (const [, role] of nonStaff)
        await channel.permissionOverwrites.edit(role, { SendMessages: null }).catch(() => {});
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlockchannel')
        .setDescription('🔓 Unlock the channel and reset all role restrictions.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply();
        await unlockChannel(interaction.channel, interaction.guild);
        await interaction.editReply('🔓 **Channel Unlocked!** All role restrictions have been cleared and chat is open. 🗣️');
    },

    async prefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
            return message.reply('❌ You need **Manage Channels** permission.');
        await unlockChannel(message.channel, message.guild);
        return message.reply('🔓 **Channel Unlocked!** Chat is open again.');
    }
};
