const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

async function lockChannel(channel, guild) {
    const nonStaff = guild.roles.cache.filter(r =>
        !r.permissions.has(PermissionFlagsBits.ManageMessages) &&
        !r.permissions.has(PermissionFlagsBits.Administrator) &&
        r.name !== '@everyone'
    );
    for (const [, role] of nonStaff)
        await channel.permissionOverwrites.edit(role, { SendMessages: false }).catch(() => {});
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockchannel')
        .setDescription('🔒 Lock the channel from all non-staff roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply();
        await lockChannel(interaction.channel, interaction.guild);
        await interaction.editReply('🛡️ **Channel Locked!** All non-staff roles have been restricted. 🔒');
    },

    async prefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
            return message.reply('❌ You need **Manage Channels** permission.');
        await lockChannel(message.channel, message.guild);
        return message.reply('🔒 **Channel Locked!** All non-staff roles have been restricted.');
    }
};
