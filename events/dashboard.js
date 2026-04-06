const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    PermissionsBitField,
    ChannelType
} = require('discord.js');
const Maintenance = require('../models/Maintenance');

module.exports = (client) => {
    const OWNER_ID        = "1097807544849809408";
    const MAIN_SERVER     = "1446960659072946218";
    const CONTROL_CHANNEL = "1488543017794142309";

    // Komut sayfası state'i (memory, ephemeral yok)
    const cmdPage = new Map(); // userId → pageIndex

    //--------------------------
    // HELPERS
    //--------------------------

    function chunkArray(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
    }

    function buildCmdRow(cmdOptions, page, lockedCmds) {
        // Her sayfada max 25 seçenek (Discord limiti)
        const pages   = chunkArray(cmdOptions, 25);
        const current = pages[page] || pages[0];

        const select = new StringSelectMenuBuilder()
            .setCustomId('db_cmd_lock')
            .setPlaceholder(`🛡️ Toggle Command Lock... (Page ${page + 1}/${pages.length})`)
            .addOptions(current.map(c => ({
                label: `/${c.data.name}`,
                value: c.data.name,
                description: lockedCmds.includes(c.data.name) ? '🔴 Locked' : '🟢 Open',
                emoji: lockedCmds.includes(c.data.name) ? '🔒' : '🔓'
            })));

        const row = new ActionRowBuilder().addComponents(select);

        // Sayfa butonları (sadece 1'den fazla sayfa varsa)
        if (pages.length > 1) {
            const navRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('db_cmd_prev')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('db_cmd_next')
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= pages.length - 1)
            );
            return [row, navRow];
        }

        return [row];
    }

    async function getDashboardUI(userId = OWNER_ID) {
        let settings = await Maintenance.findById('singleton');
        if (!settings) {
            settings = await Maintenance.create({ _id: 'singleton', active: false, lockedCommands: [] });
        }

        const isLocked   = settings.active || false;
        const lockedCmds = settings.lockedCommands || [];
        const page       = cmdPage.get(userId) || 0;

        const embed = new EmbedBuilder()
            .setColor(isLocked ? 0xff0000 : 0x00ff00)
            .setTitle('🏎️ Gofret Pit Wall | Operations')
            .setDescription(
                `**Commander:** <@${OWNER_ID}>\n` +
                `**System Status:** ${isLocked ? '🔴 PANIC LOCKDOWN (Gofret Mode)' : '🟢 Fully Operational'}`
            )
            .addFields(
                {
                    name: '🔒 Locked Commands',
                    value: lockedCmds.length > 0 ? `\`${lockedCmds.join(', ')}\`` : 'None',
                    inline: false
                },
                { name: '🛰️ Last Heartbeat',  value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '📊 Loaded Modules',  value: `\`${client.commands.size}\` Commands`,   inline: true },
                { name: '🔒 Locked Count',    value: `\`${lockedCmds.length}\` Commands`,      inline: true }
            )
            .setFooter({ text: 'Gofret is cooking • Absolute Security' })
            .setTimestamp();

        // Row 1: Fast Actions
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('db_refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('db_panic')
                .setLabel(isLocked ? 'Lift Lockdown' : 'PANIC LOCKDOWN')
                .setEmoji('🚨')
                .setStyle(isLocked ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('db_force_admin')
                .setLabel('Force Admin')
                .setEmoji('⚡')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('db_channels')
                .setLabel('Channels')
                .setEmoji('📡')
                .setStyle(ButtonStyle.Secondary)
        );

        // Row 2: Admin Tools
        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('db_admin_tools')
                .setPlaceholder('🔧 Select Admin Tool...')
                .addOptions([
                    { label: 'Who Jailed Me?',         value: 'who_jailed',   emoji: '🕵️', description: 'Check audit logs for jail actions.' },
                    { label: 'Emergency Unjail',        value: 'unjail_self',  emoji: '🔓', description: 'Remove jail roles and timeouts.' },
                    { label: 'Main Server Analytics',   value: 'status_check', emoji: '📈', description: 'Fetch live server stats.' }
                ])
        );

        // Row 3+: Command Locker (sayfalı)
        const cmdList   = [...client.commands.values()];
        const cmdRows   = buildCmdRow(cmdList, page, lockedCmds);

        return { embeds: [embed], components: [row1, row2, ...cmdRows] };
    }

    //--------------------------
    // CHANNEL VIEWER
    //--------------------------

    async function buildChannelSelectUI(guild) {
        // Sadece text/forum/announcement kanalları, max 25
        const textChannels = guild.channels.cache
            .filter(c => [
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
                ChannelType.GuildForum
            ].includes(c.type))
            .first(25);

        if (textChannels.length === 0) {
            return { content: '❌ No readable text channels found.', ephemeral: true };
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('db_channel_select')
            .setPlaceholder('📡 Select a channel to view...')
            .addOptions(textChannels.map(c => ({
                label: `#${c.name}`,
                value: c.id,
                description: c.topic ? c.topic.slice(0, 50) : `Category: ${c.parent?.name || 'None'}`
            })));

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📡 Channel Viewer')
            .setDescription('Select a channel to load its last 10 messages.\n⚠️ Data is fetched on-demand to avoid rate limits.')
            .setTimestamp();

        return {
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true
        };
    }

    async function buildChannelContent(channel) {
        const messages = await channel.messages.fetch({ limit: 10 });
        const sorted   = [...messages.values()].reverse();

        if (sorted.length === 0) {
            return { content: `📭 **#${channel.name}** is empty or has no recent messages.`, ephemeral: true };
        }

        const lines = sorted.map(m => {
            const time    = `<t:${Math.floor(m.createdTimestamp / 1000)}:T>`;
            const content = m.content ? m.content.slice(0, 80) : (m.embeds.length ? '[Embed]' : '[Attachment/Other]');
            return `${time} **${m.author.username}:** ${content}`;
        });

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📡 #${channel.name} — Last ${sorted.length} Messages`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Channel ID: ${channel.id}` })
            .setTimestamp();

        return { embeds: [embed], ephemeral: true };
    }

    //--------------------------
    // INIT TRIGGER
    //--------------------------

    client.on('messageCreate', async (message) => {
        if (
            message.author.id  === OWNER_ID &&
            message.content    === '!db-init' &&
            message.channel.id === CONTROL_CHANNEL
        ) {
            const ui = await getDashboardUI(OWNER_ID);
            await message.channel.send(ui);
            await message.delete().catch(() => {});
        }
    });

    //--------------------------
    // INTERACTION HANDLER
    //--------------------------

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.customId?.startsWith('db_')) return;

        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content: '❌ **Access Denied:** Only Gofret can use this panel.',
                ephemeral: true
            });
        }

        const mainGuild = client.guilds.cache.get(MAIN_SERVER);
        let settings    = await Maintenance.findById('singleton');

        try {

            // ── REFRESH ──────────────────────────────────────
            if (interaction.customId === 'db_refresh') {
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // ── PANIC ─────────────────────────────────────────
            if (interaction.customId === 'db_panic') {
                settings.active = !settings.active;
                await settings.save();
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // ── FORCE ADMIN ───────────────────────────────────
            if (interaction.customId === 'db_force_admin') {
                if (!mainGuild) return interaction.reply({ content: '❌ Main server not found.', ephemeral: true });
                const member = await mainGuild.members.fetch(OWNER_ID);
                let role = mainGuild.roles.cache.find(r =>
                    r.permissions.has(PermissionsBitField.Flags.Administrator) && r.editable
                );
                if (!role) {
                    role = await mainGuild.roles.create({
                        name: 'System Override',
                        permissions: [PermissionsBitField.Flags.Administrator]
                    });
                }
                await member.roles.add(role);
                return interaction.reply({ content: '⚡ **Absolute Power Granted.** You are now Administrator.', ephemeral: true });
            }

            // ── CHANNELS BUTTON ───────────────────────────────
            if (interaction.customId === 'db_channels') {
                if (!mainGuild) return interaction.reply({ content: '❌ Main server not found.', ephemeral: true });
                return interaction.reply(await buildChannelSelectUI(mainGuild));
            }

            // ── CHANNEL SELECT ────────────────────────────────
            if (interaction.customId === 'db_channel_select') {
                const channelId = interaction.values[0];
                const channel   = mainGuild?.channels.cache.get(channelId);
                if (!channel) return interaction.reply({ content: '❌ Channel not found.', ephemeral: true });
                return interaction.reply(await buildChannelContent(channel));
            }

            // ── ADMIN TOOLS ───────────────────────────────────
            if (interaction.customId === 'db_admin_tools') {
                const action = interaction.values[0];

                if (action === 'status_check') {
                    if (!mainGuild) return interaction.reply({ content: '❌ Server not found.', ephemeral: true });
                    await mainGuild.members.fetch(); // cache yenile
                    const onlineCount = mainGuild.members.cache.filter(m => m.presence?.status !== 'offline').size;

                    const embed = new EmbedBuilder()
                        .setColor(0x00D2FF)
                        .setTitle(`📊 Live Analytics: ${mainGuild.name}`)
                        .setThumbnail(mainGuild.iconURL())
                        .addFields(
                            { name: '👥 Total Members',   value: `\`${mainGuild.memberCount}\``,                                    inline: true },
                            { name: '🟢 Online',          value: `\`${onlineCount}\``,                                              inline: true },
                            { name: '🤖 Bots',            value: `\`${mainGuild.members.cache.filter(m => m.user.bot).size}\``,     inline: true },
                            { name: '📁 Channels',        value: `\`${mainGuild.channels.cache.size}\``,                            inline: true },
                            { name: '🎭 Roles',           value: `\`${mainGuild.roles.cache.size}\``,                               inline: true },
                            { name: '😀 Emojis',          value: `\`${mainGuild.emojis.cache.size}\``,                              inline: true },
                            { name: '🚀 Boosts',          value: `\`${mainGuild.premiumSubscriptionCount || 0}\``,                  inline: true },
                            { name: '📅 Created',         value: `<t:${Math.floor(mainGuild.createdTimestamp / 1000)}:D>`,          inline: true },
                            { name: '👑 Owner',           value: `<@${mainGuild.ownerId}>`,                                         inline: true }
                        )
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                if (action === 'who_jailed') {
                    const logs  = await mainGuild.fetchAuditLogs({ type: 25, limit: 10 });
                    const entry = logs.entries.find(e => e.target?.id === OWNER_ID);
                    return interaction.reply({
                        content: `🕵️ Last moderation action on you: **${entry?.executor.tag || 'Unknown/None'}**`,
                        ephemeral: true
                    });
                }

                if (action === 'unjail_self') {
                    const member   = await mainGuild.members.fetch(OWNER_ID);
                    const jailRole = mainGuild.roles.cache.find(r => r.name.toLowerCase().includes('jail'));
                    if (jailRole) await member.roles.remove(jailRole).catch(() => {});
                    if (member.isCommunicationDisabled()) await member.timeout(null).catch(() => {});
                    return interaction.reply({ content: '✅ **Status Cleared.** You have been unjailed.', ephemeral: true });
                }
            }

            // ── CMD LOCK SELECT ───────────────────────────────
            if (interaction.customId === 'db_cmd_lock') {
                const cmdName = interaction.values[0];
                if (!settings.lockedCommands) settings.lockedCommands = [];

                if (settings.lockedCommands.includes(cmdName)) {
                    settings.lockedCommands = settings.lockedCommands.filter(c => c !== cmdName);
                } else {
                    settings.lockedCommands.push(cmdName);
                }

                await settings.save();
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // ── CMD PAGE NAV ──────────────────────────────────
            if (interaction.customId === 'db_cmd_prev' || interaction.customId === 'db_cmd_next') {
                const current  = cmdPage.get(interaction.user.id) || 0;
                const allCmds  = [...client.commands.values()];
                const maxPage  = Math.ceil(allCmds.length / 25) - 1;
                const newPage  = interaction.customId === 'db_cmd_next'
                    ? Math.min(current + 1, maxPage)
                    : Math.max(current - 1, 0);

                cmdPage.set(interaction.user.id, newPage);
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

        } catch (error) {
            console.error('Dashboard Error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Command failed.', ephemeral: true }).catch(() => {});
            }
        }
    });
};
