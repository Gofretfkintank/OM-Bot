const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

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
        .setDescription('Unlock the channel and reset all role restrictions.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply();
        await unlockChannel(interaction.channel, interaction.guild);
        await interaction.editReply({ embeds: [
            ok(`🔓 **Channel Unlocked!** Chat is open again.`)
                .setFooter({ text: `Unlocked by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    },

    async prefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
            return message.reply({ embeds: [err('❌ You need **Manage Channels** permission.')] });
        await unlockChannel(message.channel, message.guild);
        return message.reply({ embeds: [
            ok(`🔓 **Channel Unlocked!** Chat is open again.`)
                .setFooter({ text: `Unlocked by ${message.author.tag}` })
                .setTimestamp()
        ]});
    }
};
