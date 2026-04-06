const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    StringSelectMenuBuilder, PermissionsBitField, ComponentType 
} = require('discord.js');
const Maintenance = require('../models/Maintenance');

// Casusluk için aktif kanalı bellekte tutuyoruz
let activeSpyChannelId = null;

module.exports = (client) => {
    const OWNER_ID = "1097807544849809408";
    const MAIN_SERVER = "1446960659072946218";
    const CONTROL_CHANNEL = "1488543017794142309";

    async function getDashboardUI(page = 1) {
        let settings = await Maintenance.findById('singleton');
        if (!settings) settings = await Maintenance.create({ _id: 'singleton', active: false, lockedCommands: [] });

        const isLocked = settings.active || false;
        const lockedCmds = settings.lockedCommands || [];
        
        const embed = new EmbedBuilder()
            .setColor(isLocked ? 0xff0000 : 0x00ff00)
            .setTitle('🏎️ Gofret Pit Wall | Operations')
            .setDescription(`**Commander:** <@${OWNER_ID}>\n**System Status:** ${isLocked ? '🔴 PANIC LOCKDOWN' : '🟢 Operational'}`)
            .addFields(
                { name: '🕵️ Active Spy:', value: activeSpyChannelId ? `<#${activeSpyChannelId}>` : 'None', inline: true },
                { name: '🔒 Locked:', value: `\`${lockedCmds.length}\` Commands`, inline: true },
                { name: '🛰️ Uptime:', value: `<t:${Math.floor(client.readyTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: `Gofret is cooking • Command Page ${page}` });

        // Row 1: Ana Butonlar
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('db_refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('db_panic').setLabel(isLocked ? 'Unlock All' : 'PANIC LOCKDOWN').setStyle(isLocked ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`db_page_${page === 1 ? 2 : 1}`).setLabel(`Cmd Page ${page === 1 ? 2 : 1}`).setStyle(ButtonStyle.Primary)
        );

        // Row 2: Komut Kilitleme (Sayfalamalı)
        const allCommands = Array.from(client.commands.values());
        const start = (page - 1) * 20;
        const end = start + 20;
        const pagedCommands = allCommands.slice(start, end);

        const cmdOptions = pagedCommands.map(c => ({
            label: `/${c.data.name}`,
            value: c.data.name,
            emoji: lockedCmds.includes(c.data.name) ? '🔒' : '🔓'
        }));

        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('db_cmd_lock')
                .setPlaceholder(`🛡️ Lock/Unlock Commands (Page ${page})...`)
                .addOptions(cmdOptions)
        );

        // Row 3: Canlı Kanal Casusu (Main Server Kanalları)
        const mainGuild = client.guilds.cache.get(MAIN_SERVER);
        const channels = mainGuild ? mainGuild.channels.cache
            .filter(c => c.type === 0) // Sadece yazı kanalları
            .first(25) : [];

        const channelOptions = channels.map(c => ({
            label: `# ${c.name}`,
            value: c.id,
            description: `Listen to all messages in ${c.name}`,
            emoji: '👁️'
        }));

        const row3 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('db_spy_select')
                .setPlaceholder('👁️ Select Channel to Spy...')
                .addOptions([{ label: '❌ Stop Spying', value: 'stop' }, ...channelOptions])
        );

        return { embeds: [embed], components: [row1, row2, row3] };
    }

    // --- CASUSLUK MOTORU ---
    client.on('messageCreate', async (message) => {
        // Dashboard tetikleme
        if (message.author.id === OWNER_ID && message.content === '!db-init' && message.channel.id === CONTROL_CHANNEL) {
            await message.channel.send(await getDashboardUI(1));
            return message.delete();
        }

        // Casusluk: Eğer mesaj izlenen kanaldaysa ve botun kendisi değilse pasla
        if (activeSpyChannelId && message.channel.id === activeSpyChannelId && !message.author.bot) {
            const controlChannel = client.channels.cache.get(CONTROL_CHANNEL);
            if (controlChannel) {
                const spyEmbed = new EmbedBuilder()
                    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                    .setDescription(message.content || "*Attachment/Embed*")
                    .setColor(0x3498db)
                    .setFooter({ text: `From: #${message.channel.name}` })
                    .setTimestamp();
                
                if (message.attachments.size > 0) spyEmbed.setImage(message.attachments.first().url);
                
                await controlChannel.send({ embeds: [spyEmbed] });
            }
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.customId?.startsWith('db_') || interaction.user.id !== OWNER_ID) return;

        let settings = await Maintenance.findById('singleton');

        if (interaction.customId.startsWith('db_page_')) {
            const page = parseInt(interaction.customId.split('_')[2]);
            await interaction.update(await getDashboardUI(page));
        }

        if (interaction.customId === 'db_panic') {
            settings.active = !settings.active;
            await settings.save();
            await interaction.update(await getDashboardUI());
        }

        if (interaction.customId === 'db_cmd_lock') {
            const cmdName = interaction.values[0];
            if (settings.lockedCommands.includes(cmdName)) {
                settings.lockedCommands = settings.lockedCommands.filter(c => c !== cmdName);
            } else {
                settings.lockedCommands.push(cmdName);
            }
            await settings.save();
            await interaction.update(await getDashboardUI());
        }

        if (interaction.customId === 'db_spy_select') {
            const selected = interaction.values[0];
            activeSpyChannelId = selected === 'stop' ? null : selected;
            await interaction.reply({ content: activeSpyChannelId ? `👁️ Now spying on <#${selected}>` : "❌ Spy mode deactivated.", ephemeral: true });
            // Dashboard'ı da güncelle ki aktif kanal gözüksün
            const msg = await interaction.channel.messages.fetch(interaction.message.id);
            await msg.edit(await getDashboardUI());
        }

        if (interaction.customId === 'db_refresh') {
            await interaction.update(await getDashboardUI());
        }
    });
};
