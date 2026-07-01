const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure server-specific bot settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('logs')
                .setDescription('Set (or clear) the audit log channel for this server.')
                .addChannelOption(o =>
                    o.setName('channel')
                        .setDescription('Channel to send logs to. Leave empty to disable logging.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub !== 'logs') return;

        const channel = interaction.options.getChannel('channel');
        await interaction.deferReply();

        await GuildConfig.findOneAndUpdate(
            { guildId: interaction.guildId },
            { $set: { logChannelId: channel ? channel.id : null } },
            { upsert: true }
        );

        // Bust events/logs.js's in-memory cache so the change applies immediately
        interaction.client.emit('logConfigUpdate', interaction.guildId);

        if (!channel) {
            return interaction.editReply({ embeds: [
                ok('🔕 Audit logging has been disabled for this server.')
                    .setFooter({ text: `Set by ${interaction.user.tag}` })
                    .setTimestamp()
            ]});
        }

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
};
