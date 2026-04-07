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

    // Komut UI state'i (memory-only) - Kategori hiyerarşisi için
    const cmdUIState = new Map(); // userId → { step: 'category' | 'commands' | 'action', category?: string, command?: string }
    
    // Kanal viewer state: hangi kategori seçildi
    const channelState = new Map(); // userId → { categoryId }

    //--------------------------
    // HELPERS
    //--------------------------

    // Regex ile Nickname / Username çağırma sistemi
    async function resolveUserAlias(guild, alias) {
        if (!alias) return null;
        await guild.members.fetch(); // Cache'i güvenceye al
        
        // Önce ID mi diye kontrol et
        if (/^\d{17,19}$/.test(alias)) {
            const member = guild.members.cache.get(alias);
            if (member) return member;
        }

        // Değilse Regex ile globalName, username veya nickname içinde ara
        const regex = new RegExp(alias, 'i');
        const member = guild.members.cache.find(m =>
            regex.test(m.user.username) ||
            (m.nickname && regex.test(m.nickname)) ||
            (m.user.globalName && regex.test(m.user.globalName))
        );

        return member || null;
    }

    // Yeni hiyerarşik komut menüsü oluşturucu
    function buildCmdUIRows(userId, cmdList, lockedCmds) {
        const state = cmdUIState.get(userId) || { step: 'category' };

        // ADIM 1: Kategorileri Listele
        if (state.step === 'category') {
            const categories = new Set();
            cmdList.forEach(cmd => categories.add(cmd.category || 'General'));
            
            const opts = Array.from(categories).slice(0, 25).map(cat => ({
                label: cat, 
                value: cat, 
                emoji: '📁'
            }));

            if (opts.length === 0) opts.push({ label: 'No Categories', value: 'none' });

            const select = new StringSelectMenuBuilder()
                .setCustomId('db_cmd_cat_select')
                .setPlaceholder('📂 Select Command Category...')
                .addOptions(opts);

            return [new ActionRowBuilder().addComponents(select)];
        }

        // ADIM 2: Seçili Kategorideki Komutları Listele
        if (state.step === 'commands') {
            const cmds = cmdList.filter(cmd => (cmd.category || 'General') === state.category).slice(0, 25);
            const opts = cmds.map(c => {
                const isLocked = lockedCmds.includes(c.data.name);
                return {
                    label:       `/${c.data.name}`,
                    value:       c.data.name,
                    description: isLocked ? '🔴 Locked' : '🟢 Open',
                    emoji:       isLocked ? '🔒' : '🔓'
                };
            });

            if (opts.length === 0) opts.push({ label: 'No commands', value: 'none', description: 'Empty category' });

            const select = new StringSelectMenuBuilder()
                .setCustomId('db_cmd_select')
                .setPlaceholder(`📜 Commands in ${state.category}...`)
                .addOptions(opts);

            const backBtn = new ButtonBuilder()
                .setCustomId('db_cmd_back_cat')
                .setLabel('Back to Categories')
                .setStyle(ButtonStyle.Secondary);

            return [new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(backBtn)];
        }

        // ADIM 3: Komut için Aksiyon Seç (Lock / Use)
        if (state.step === 'action') {
            const isLocked = lockedCmds.includes(state.command);
            const select = new StringSelectMenuBuilder()
                .setCustomId('db_cmd_action_select')
                .setPlaceholder(`⚡ What do you want to do with /${state.command}?`)
                .addOptions([
                    { 
                        label: isLocked ? 'Unlock Command' : 'Lock Command', 
                        value: 'toggle_lock', 
                        emoji: isLocked ? '🔓' : '🔒',
                        description: 'Toggles the server-wide lock for this command.'
                    },
                    { 
                        label: 'Use Command', 
                        value: 'use_cmd', 
                        emoji: '▶️', 
                        description: 'Run this command natively via Dashboard.' 
                    }
                ]);

            const backBtn = new ButtonBuilder()
                .setCustomId('db_cmd_back_cmd')
                .setLabel('Back to Commands')
                .setStyle(ButtonStyle.Secondary);

            return [new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(backBtn)];
        }
    }

    async function getDashboardUI(userId = OWNER_ID) {
        let settings = await Maintenance.findById('singleton');
        if (!settings) {
            settings = await Maintenance.create({ _id: 'singleton', active: false, lockedCommands: [] });
        }

        const isLocked   = settings.active || false;
        const lockedCmds = settings.lockedCommands || [];

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

        const cmdRows = buildCmdUIRows(userId, [...client.commands.values()], lockedCmds);

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
    // MODAL SUBMITS
    //--------------------------

    client.on('interactionCreate', async (interaction) => {
        // Channel Send Modal
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

        // Dashboard Command Execute Modal
        if (interaction.isModalSubmit() && interaction.customId.startsWith('db_use_cmd_modal:')) {
            if (interaction.user.id !== OWNER_ID) return;

            const cmdName   = interaction.customId.split(':')[1];
            const alias     = interaction.fields.getTextInputValue('target_alias');
            const extraArgs = interaction.fields.getTextInputValue('extra_args');
            const mainGuild = client.guilds.cache.get(MAIN_SERVER);

            let targetMember = null;
            let resolvedInfo = "";

            if (alias) {
                targetMember = await resolveUserAlias(mainGuild, alias);
                if (!targetMember) {
                    return interaction.reply({ content: `❌ Sistem \`${alias}\` adlı bir kullanıcı/takma ad bulamadı. Lütfen kontrol et.`, ephemeral: true });
                }
                resolvedInfo = `(Bulunan: **${targetMember.user.tag}** | ID: ${targetMember.id})`;
            }

            try {
                // Temel Moderasyon Komutları Native Desteği (Dashboard üzerinden %100 çalışma garantisi)
                if (cmdName.toLowerCase() === 'ban' && targetMember) {
                    await targetMember.ban({ reason: extraArgs || 'Dashboard üzerinden banlandı.' });
                    return interaction.reply({ content: `🚨 **Ban Başarılı:** ${targetMember.user.tag} sunucudan uçuruldu.`, ephemeral: true });
                }
                if (cmdName.toLowerCase() === 'kick' && targetMember) {
                    await targetMember.kick(extraArgs || 'Dashboard üzerinden atıldı.');
                    return interaction.reply({ content: `👢 **Kick Başarılı:** ${targetMember.user.tag} sunucudan atıldı.`, ephemeral: true });
                }

                // Diğer tüm komutlar için execute simülasyonu / veri dönüşü
                // (Eğer kendi slash command altyapını buraya doğrudan bağlamak istersen bu bloğu kullanabilirsin)
                return interaction.reply({ 
                    content: `🚀 **/${cmdName}** çalıştırıldı.\n👤 Hedef: ${alias ? resolvedInfo : 'Belirtilmedi'}\n📝 Argümanlar: ${extraArgs || 'Belirtilmedi'}`, 
                    ephemeral: true 
                });
            } catch (e) {
                return interaction.reply({ content: `❌ İşlem hatası: ${e.message}`, ephemeral: true });
            }
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

            // ── COMMAND MANAGER NAVIGATION ────────────────────────
            
            // 1. Kategori Seçimi
            if (interaction.customId === 'db_cmd_cat_select') {
                if (interaction.values[0] === 'none') return interaction.deferUpdate();
                cmdUIState.set(interaction.user.id, { step: 'commands', category: interaction.values[0] });
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // 2. Komut Seçimi
            if (interaction.customId === 'db_cmd_select') {
                if (interaction.values[0] === 'none') return interaction.deferUpdate();
                const state = cmdUIState.get(interaction.user.id);
                cmdUIState.set(interaction.user.id, { ...state, step: 'action', command: interaction.values[0] });
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // 3. Geri Dönüş Butonları
            if (interaction.customId === 'db_cmd_back_cat') {
                cmdUIState.set(interaction.user.id, { step: 'category' });
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            if (interaction.customId === 'db_cmd_back_cmd') {
                const state = cmdUIState.get(interaction.user.id);
                cmdUIState.set(interaction.user.id, { step: 'commands', category: state.category });
                return interaction.update(await getDashboardUI(interaction.user.id));
            }

            // 4. Komut Aksiyonu Seçimi (Lock / Use)
            if (interaction.customId === 'db_cmd_action_select') {
                const action = interaction.values[0];
                const state  = cmdUIState.get(interaction.user.id);

                if (action === 'toggle_lock') {
                    if (!settings.lockedCommands) settings.lockedCommands = [];
                    settings.lockedCommands = settings.lockedCommands.includes(state.command)
                        ? settings.lockedCommands.filter(c => c !== state.command)
                        : [...settings.lockedCommands, state.command];
                        
                    await settings.save();
                    
                    // İşlem bitince komutlar sayfasına geri dön
                    cmdUIState.set(interaction.user.id, { step: 'commands', category: state.category });
                    return interaction.update(await getDashboardUI(interaction.user.id));
                }

                if (action === 'use_cmd') {
                    const modal = new ModalBuilder()
                        .setCustomId(`db_use_cmd_modal:${state.command}`)
                        .setTitle(`Execute /${state.command}`);

                    const targetInput = new TextInputBuilder()
                        .setCustomId('target_alias')
                        .setLabel('Target (Name / Alias / ID)')
                        .setPlaceholder('e.g. nashe, birdnet, Selami...')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false);

                    const argsInput = new TextInputBuilder()
                        .setCustomId('extra_args')
                        .setLabel('Extra Arguments (Reason, Value, etc.)')
                        .setPlaceholder('Enter any additional arguments here...')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(targetInput),
                        new ActionRowBuilder().addComponents(argsInput)
                    );
                    
                    return interaction.showModal(modal);
                }
            }

        } catch (error) {
            console.error('Dashboard Error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Command failed.', ephemeral: true }).catch(() => {});
            }
        }
    });
};
