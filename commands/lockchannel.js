const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

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
        .setDescription('Lock the channel from all non-staff roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply();
        await lockChannel(interaction.channel, interaction.guild);
        await interaction.editReply({ embeds: [
            ok(`🔒 **Channel Locked!** All non-staff roles have been restricted.`)
                .setFooter({ text: `Locked by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
            return message.reply({ embeds: [err('❌ You need **Manage Channels** permission.')] });
        await lockChannel(message.channel, message.guild);
        return message.reply({ embeds: [
            ok(`🔒 **Channel Locked!** All non-staff roles have been restricted.`)
                .setFooter({ text: `Locked by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
