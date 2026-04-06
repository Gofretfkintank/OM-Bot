const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    PermissionsBitField,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const Maintenance = require('../models/Maintenance');

module.exports = (client) => {
    const OWNER_ID        = "1097807544849809408";
    const MAIN_SERVER     = "1446960659072946218";
    const CONTROL_CHANNEL = "1488543017794142309";

    // Komut sayfa state'i (memory-only)
    const cmdPage = new Map();
    // Kanal viewer state: hangi kategori seçildi
    const channelState = new Map(); // userId → { categoryId }

    //--------------------------
    // HELPERS
    //--------------------------

    function chunkArray(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
    }

    function buildCmdRows(cmdList, page, lockedCmds) {
        const pages   = chunkArray(cmdList, 25);
        const current = pages[page] || pages[0];

        const select = new StringSelectMenuBuilder()
            .setCustomId('db_cmd_lock')
            .setPlaceholder(`🛡️ Toggle Command Lock... (Page ${page + 1}/${pages.length})`)
            .addOptions(current.map(c => ({
                label:       `/${c.data.name}`,
                value:       c.data.name,
                description: lockedCmds.includes(c.data.name) ? '🔴 Locked' : '🟢 Open',
                emoji:       lockedCmds.includes(c.data.name) ? '🔒' : '🔓'
            })));

        const rows = [new ActionRowBuilder().addComponents(select)];

        if (pages.length > 1) {
            rows.push(new ActionRowBuilder().addComponents(
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
            ));
        }

        return rows;
    }

    async function getDashboardUI(userId = OWNER_ID) {
        let settings = await Maintenance.findById('singleton');
        if (!settings) {
            settings = await Maintenance.create({ _id: 'singleton', active: false, lockedCommands: [] });
        }

        const isLocked   = settings.active || false;
        const lockedCmds = settings.lockedCommands || [];
        const page       = cmdPage.get(userId) || 0;

        // Online count — GuildPresences intent gerekli
        const guild      = client.guilds.cache.get(MAIN_SERVER);
        const onlineCount = guild
            ? guild.members.cache.filter(m =>
                !m.user.bot && m.presence?.status && m.presence.status !== 'offline'
              ).size
            : 0;

        const embed = new EmbedBuilder()
            .setColor(isLocked ? 0xff0000 : 0x00ff00)
            .setTitle('🏎️ Gofret Pit Wall | Operations')
            .setDescription(
                `**Commander:** <@${OWNER_ID}>\n` +
                `**System Status:** ${isLocked ? '🔴 PANIC LOCKDOWN (Gofret Mode)' : '🟢 Fully Operational'}`
            )
            .addFields(
                { name: '🔒 Locked Commands', value: lockedCmds.length > 0 ? `\`${lockedCmds.join(', ')}\`` : 'None', inline: false },
                { name: '🛰️ Last Heartbeat',  value: `<t:${Math.floor(Date.now() / 1000)}:R>`,   inline: true },
                { name: '📊 Loaded Modules',  value: `\`${client.commands.size}\` Commands`,      inline: true },
                { name: '🟢 Online Now',       value: `\`${onlineCount}\``,                       inline: true }
            )
            .setFooter({ text: 'Gofret is cooking • Absolute Security' })
            .setTimestamp();

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

        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('db_admin_tools')
                .setPlaceholder('🔧 Select Admin Tool...')
                .addOptions([
                    { label: 'Who Jailed Me?',       value: 'who_jailed',   emoji: '🕵️', description: 'Check audit logs for jail actions.' },
                    { label: 'Emergency Unjail',      value: 'unjail_self',  emoji: '🔓', description: 'Remove jail roles and timeouts.' },
                    { label: 'Main Server Analytics', value: 'status_check', emoji: '📈', description: 'Fetch live server stats.' }
                ])
        );

        const cmdRows = buildCmdRows([...client.commands.values()], page, lockedCmds);

        return { embeds: [embed], components: [row1, row2, ...cmdRows] };
    }

    //--------------------------
    // CHANNEL VIEWER — Step 1: Kategori listesi
    //--------------------------

    function buildCategorySelect(guild) {
        const categories = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildCategory)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .first(25);

        if (categories.length === 0) {
            return { content: '❌ No categories found.', ephemeral: true };
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('db_category_select')
            .setPlaceholder('📂 Select a category...')
            .addOptions(categories.map(cat => {
                const childCount = guild.channels.cache.filter(c => c.parentId === cat.id).size;
                return {
                    label:       cat.name.slice(0, 25),
                    value:       cat.id,
                    description: `${childCount} channel${childCount !== 1 ? 's' : ''}`
                };
            }));

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📡 Channel Viewer — Step 1')
            .setDescription('Select a **category** to browse its channels.')
            .setTimestamp();

        return {
            embeds:     [embed],
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral:  true
        };
    }

    //--------------------------
    // CHANNEL VIEWER — Step 2: Kategorideki kanallar
    //--------------------------

    function buildChannelSelect(guild, categoryId) {
        const category = guild.channels.cache.get(categoryId);
        const channels = guild.channels.cache
            .filter(c =>
                c.parentId === categoryId &&
                [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(c.type)
            )
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .first(25);

        if (channels.length === 0) {
            return { content: `❌ No readable channels in **${category?.name || 'this category'}**.`, ephemeral: true };
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('db_channel_select')
            .setPlaceholder('📡 Select a channel...')
            .addOptions(channels.map(c => ({
                label:       `#${c.name}`.slice(0, 25),
                value:       c.id,
                description: c.topic ? c.topic.slice(0, 50) : `${channelTypeName(c.type)} channel`
            })));

        // "View messages" ve "Send message" seçeneklerini ayrı tutuyoruz —
        // kanal seçimi yapılınca ne yapmak istediğini soran 2. menü gelecek
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📡 Channel Viewer — ${category?.name || 'Category'}`)
            .setDescription('Select a channel to **view messages** or **send a message** as the bot.')
            .setTimestamp();

        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('db_channels')
                .setLabel('← Back to Categories')
                .setStyle(ButtonStyle.Secondary)
        );

        return {
            embeds:     [embed],
            components: [new ActionRowBuilder().addComponents(select), backRow],
            ephemeral:  true
        };
    }

    //--------------------------
    // CHANNEL VIEWER — Step 3: Ne yapmak istiyorsun?
    //--------------------------

    function buildChannelActions(channelId, channelName) {
        const select = new StringSelectMenuBuilder()
            .setCustomId('db_channel_action')
            .setPlaceholder('What do you want to do?')
            .addOptions([
                {
                    label:       '📖 View Last Messages',
                    value:       `view:${channelId}`,
                    description: 'Load the last 10 messages from this channel.',
                    emoji:       '📖'
                },
                {
                    label:       '✉️ Send Message as Bot',
                    value:       `send:${channelId}`,
                    description: 'Type a message and bot will post it in this channel.',
                    emoji:       '✉️'
                }
            ]);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📡 #${channelName}`)
            .setDescription('Choose an action for this channel.')
            .setTimestamp();

        return {
            embeds:     [embed],
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral:  true
        };
    }

    //--------------------------
    // CHANNEL VIEWER — Mesaj görüntüle
    //--------------------------

    async function buildChannelContent(channel) {
        const messages = await channel.messages.fetch({ limit: 10 });
        const sorted   = [...messages.values()].reverse();

        if (sorted.length === 0) {
            return { content: `📭 **#${channel.name}** has no recent messages.`, ephemeral: true };
        }

        const lines = sorted.map(m => {
            const time    = `<t:${Math.floor(m.createdTimestamp / 1000)}:T>`;
            const content = m.content
                ? m.content.slice(0, 80)
                : m.embeds.length
                    ? '[Embed]'
                    : m.attachments.size
                        ? '[Attachment]'
                        : '[Other]';
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
    // HELPERS
    //--------------------------

    function channelTypeName(type) {
        const map = {
            [ChannelType.GuildText]:         'Text',
            [ChannelType.GuildVoice]:        'Voice',
            [ChannelType.GuildAnnouncement]: 'Announcement',
            [ChannelType.GuildForum]:        'Forum',
            [ChannelType.GuildStageVoice]:   'Stage',
        };
        return map[type] || 'Unknown';
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
    // MODAL SUBMIT — Bot mesaj gönderimi
    //--------------------------

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isModalSubmit() && interaction.customId.startsWith('db_send_modal:')) {
            if (interaction.user.id !== OWNER_ID) return;

            const channelId = interaction.customId.split(':')[1];
            const content   = interaction.fields.getTextInputValue('db_msg_content');

            try {
                const channel = await client.channels.fetch(channelId);
                await channel.send(content);
                await interaction.reply({ content: `✅ Message sent to <#${channelId}>.`, ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ Failed to send: ${e.message}`, ephemeral: true });
            }
            return;
        }

        //--------------------------
        // DASHBOARD INTERACTIONS
        //--------------------------

        if (!interaction.customId?.startsWith('db_')) return;

        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ **Access Denied:** Only Gofret can use this panel.', ephemeral: true });
        }

        const mainGuild = client.guilds.cache.get(MAIN_SERVER);
        let settings    = await Maintenance.findById('singleton');

        try {

            // ── REFRESH ──────────────────────────────────────────
            if (interaction.customId === 'db_refresh') {
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // ── PANIC ─────────────────────────────────────────────
            if (interaction.customId === 'db_panic') {
                settings.active = !settings.active;
                await settings.save();
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // ── FORCE ADMIN ───────────────────────────────────────
            if (interaction.customId === 'db_force_admin') {
                if (!mainGuild) return interaction.reply({ content: '❌ Main server not found.', ephemeral: true });
                const member = await mainGuild.members.fetch(OWNER_ID);
                let role = mainGuild.roles.cache.find(r =>
                    r.permissions.has(PermissionsBitField.Flags.Administrator) && r.editable
                );
                if (!role) {
                    role = await mainGuild.roles.create({
                        name:        'System Override',
                        permissions: [PermissionsBitField.Flags.Administrator]
                    });
                }
                await member.roles.add(role);
                return interaction.reply({ content: '⚡ **Absolute Power Granted.**', ephemeral: true });
            }

            // ── CHANNELS — Kategori listesi ───────────────────────
            if (interaction.customId === 'db_channels') {
                if (!mainGuild) return interaction.reply({ content: '❌ Server not found.', ephemeral: true });
                const ui = buildCategorySelect(mainGuild);
                return interaction.replied || interaction.deferred
                    ? interaction.editReply(ui)
                    : interaction.reply(ui);
            }

            // ── CATEGORY SELECT ───────────────────────────────────
            if (interaction.customId === 'db_category_select') {
                const categoryId = interaction.values[0];
                channelState.set(interaction.user.id, { categoryId });
                return interaction.update(buildChannelSelect(mainGuild, categoryId));
            }

            // ── CHANNEL SELECT ────────────────────────────────────
            if (interaction.customId === 'db_channel_select') {
                const channelId  = interaction.values[0];
                const channel    = mainGuild?.channels.cache.get(channelId);
                if (!channel) return interaction.reply({ content: '❌ Channel not found.', ephemeral: true });
                return interaction.update(buildChannelActions(channelId, channel.name));
            }

            // ── CHANNEL ACTION (view / send) ──────────────────────
            if (interaction.customId === 'db_channel_action') {
                const [action, channelId] = interaction.values[0].split(':');
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel) return interaction.reply({ content: '❌ Channel not found.', ephemeral: true });

                if (action === 'view') {
                    return interaction.update(await buildChannelContent(channel));
                }

                if (action === 'send') {
                    // Modal aç — bot adına mesaj yazdır
                    const modal = new ModalBuilder()
                        .setCustomId(`db_send_modal:${channelId}`)
                        .setTitle(`Send to #${channel.name}`);

                    const input = new TextInputBuilder()
                        .setCustomId('db_msg_content')
                        .setLabel('Message Content')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(2000)
                        .setRequired(true)
                        .setPlaceholder('Type the message the bot will send...');

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    return interaction.showModal(modal);
                }
            }

            // ── ADMIN TOOLS ───────────────────────────────────────
            if (interaction.customId === 'db_admin_tools') {
                const action = interaction.values[0];

                if (action === 'status_check') {
                    if (!mainGuild) return interaction.reply({ content: '❌ Server not found.', ephemeral: true });
                    await mainGuild.members.fetch();

                    const total   = mainGuild.memberCount;
                    const bots    = mainGuild.members.cache.filter(m => m.user.bot).size;
                    const humans  = total - bots;
                    // Presence intent gerekli; yoksa 0 döner
                    const online  = mainGuild.members.cache.filter(m =>
                        !m.user.bot && m.presence?.status && m.presence.status !== 'offline'
                    ).size;

                    const embed = new EmbedBuilder()
                        .setColor(0x00D2FF)
                        .setTitle(`📊 Live Analytics: ${mainGuild.name}`)
                        .setThumbnail(mainGuild.iconURL())
                        .addFields(
                            { name: '👥 Total Members', value: `\`${total}\``,                              inline: true },
                            { name: '🧑 Humans',         value: `\`${humans}\``,                             inline: true },
                            { name: '🤖 Bots',           value: `\`${bots}\``,                              inline: true },
                            { name: '🟢 Online',          value: `\`${online}\` *(Presence Intent req.)*`,   inline: true },
                            { name: '📁 Channels',        value: `\`${mainGuild.channels.cache.size}\``,     inline: true },
                            { name: '🎭 Roles',           value: `\`${mainGuild.roles.cache.size}\``,        inline: true },
                            { name: '😀 Emojis',          value: `\`${mainGuild.emojis.cache.size}\``,       inline: true },
                            { name: '🚀 Boosts',          value: `\`${mainGuild.premiumSubscriptionCount || 0}\``, inline: true },
                            { name: '📅 Created',         value: `<t:${Math.floor(mainGuild.createdTimestamp / 1000)}:D>`, inline: true },
                            { name: '👑 Owner',           value: `<@${mainGuild.ownerId}>`,                  inline: true }
                        )
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                if (action === 'who_jailed') {
                    const { AuditLogEvent } = require('discord.js');
                    const logs  = await mainGuild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 10 });
                    const entry = logs.entries.find(e => e.target?.id === OWNER_ID);
                    return interaction.reply({
                        content:  `🕵️ Last mod action on you: **${entry?.executor.tag || 'Unknown/None'}**`,
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

            // ── CMD LOCK SELECT ───────────────────────────────────
            if (interaction.customId === 'db_cmd_lock') {
                const cmdName = interaction.values[0];
                if (!settings.lockedCommands) settings.lockedCommands = [];

                settings.lockedCommands = settings.lockedCommands.includes(cmdName)
                    ? settings.lockedCommands.filter(c => c !== cmdName)
                    : [...settings.lockedCommands, cmdName];

                await settings.save();
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // ── CMD PAGE NAV ──────────────────────────────────────
            if (interaction.customId === 'db_cmd_prev' || interaction.customId === 'db_cmd_next') {
                const current = cmdPage.get(interaction.user.id) || 0;
                const maxPage = Math.ceil(client.commands.size / 25) - 1;
                const newPage = interaction.customId === 'db_cmd_next'
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
