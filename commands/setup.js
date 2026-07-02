const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure server-specific bot settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('logs')
                .setDescription('Set the audit log channel for this server.')
                .addChannelOption(o =>
                    o.setName('channel')
                        .setDescription('Target channel (defaults to the channel you run this in)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('logs-off')
                .setDescription('Disable audit logging for this server.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply();

        if (sub === 'logs-off') {
            await GuildConfig.findOneAndUpdate(
                { guildId: interaction.guildId },
                { $set: { logChannelId: null } },
                { upsert: true }
            );
            interaction.client.emit('logConfigUpdate', interaction.guildId);

            return interaction.editReply({ embeds: [
                ok('🔕 Audit logging has been disabled for this server.')
                    .setFooter({ text: `Set by ${interaction.user.tag}` })
                    .setTimestamp()
            ]});
        }

        if (sub === 'logs') {
            // No channel given → bind to the channel the command was run in
            let channel = interaction.options.getChannel('channel');
            if (!channel) {
                if (interaction.channel?.type !== ChannelType.GuildText) {
                    return interaction.editReply({ embeds: [
                        err('❌ Run this in a normal text channel, or pass the `channel` option.')
                    ]});
                }
                channel = interaction.channel;
            }

            await GuildConfig.findOneAndUpdate(
                { guildId: interaction.guildId },
                { $set: { logChannelId: channel.id } },
                { upsert: true }
            );

            // Bust events/logs.js's in-memory cache so the change applies immediately
            interaction.client.emit('logConfigUpdate', interaction.guildId);

            const perms = channel.permissionsFor(interaction.guild.members.me);
            const missingPerms = !perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.EmbedLinks);

            const embed = ok(`📋 Audit logs will now be sent to ${channel}.`)
                .setFooter({ text: `Set by ${interaction.user.tag}` })
                .setTimestamp();

            if (missingPerms) {
                embed.addFields({
                    name: '⚠️ Warning',
                    value: 'I don\'t have Send Messages / Embed Links permission in that channel yet — logs won\'t go through until I do.'
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
