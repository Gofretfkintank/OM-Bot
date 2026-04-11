//--------------------------------------------------
// IMPORTS
//--------------------------------------------------

const {
    SlashCommandBuilder,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

//--------------------------------------------------
// CONFIG
//--------------------------------------------------

const TEAMS = [
    "BMW Racing",
    "Stuttgart-Silver Racing",
    "WRT BMW",
    "Iron Dames",
    "Aston Martin AMR",
    "Verstappen.com Racing",
    "Falken Tyres GT3",
    "Mid-Night Racing",
    "Manthey Racing"
];

const CATEGORY_ID = "1492527809971748934";

//--------------------------------------------------
// HELPERS
//--------------------------------------------------

function slugify(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function buildPanelEmbed(member, teamRole) {
    return new EmbedBuilder()
        .setColor(0xE8000D) // Motorsport kırmızısı
        .setTitle('📡 Team Radio — Secure Channel')
        .setDescription(
            `> *This channel is restricted to **${teamRole.name}** members only.*\n\n` +
            `Welcome, <@${member.id}>. You are now connected to your team's private radio.`
        )
        .addFields(
            { name: '🏎️ Team', value: teamRole.name, inline: true },
            { name: '👤 Opened by', value: `<@${member.id}>`, inline: true },
            { name: '📋 Rules', value: 'Keep communication professional. Staff may review this channel at any time.' }
        )
        .setFooter({ text: 'Olzhasstik Motorsports — Team Radio System' })
        .setTimestamp();
}

function buildControlRow(closed = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel(closed ? 'Already Closed' : 'Close Channel')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(closed),

        new ButtonBuilder()
            .setCustomId('reopen_ticket')
            .setLabel('Reopen Channel')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!closed)
    );
}

//--------------------------------------------------
// COMMAND EXPORT
//--------------------------------------------------

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teamradio')
        .setDescription('Open a private team radio channel for your team'),

    //--------------------------------------------------
    // EXECUTE
    //--------------------------------------------------

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.member;
        const guild = interaction.guild;

        // Takım rolü kontrolü
        const teamRole = member.roles.cache.find(r => TEAMS.includes(r.name));

        if (!teamRole) {
            return interaction.editReply({
                content: '❌ You do not have a valid team role. Contact staff if this is a mistake.'
            });
        }

        const channelName = `radio-${slugify(teamRole.name)}`;

        // Mevcut kanal kontrolü
        const existing = guild.channels.cache.find(c =>
            c.name === channelName &&
            c.parentId === CATEGORY_ID
        );

        if (existing) {
            return interaction.editReply({
                content: `📡 Your team already has an active radio channel: ${existing}`
            });
        }

        // Kanal oluştur
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            topic: `Team Radio | ${teamRole.name} | Opened by ${member.user.tag}`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: teamRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ]
        });

        // Panel mesajı gönder
        const embed = buildPanelEmbed(member, teamRole);
        const row = buildControlRow(false);

        await channel.send({ embeds: [embed], components: [row] });

        // Kullanıcıya bildir
        const confirmEmbed = new EmbedBuilder()
            .setColor(0x57F287) // Discord yeşili
            .setTitle('✅ Team Radio Opened')
            .setDescription(`Your team channel is ready: ${channel}`)
            .setFooter({ text: 'Only your team members can see this channel.' })
            .setTimestamp();

        return interaction.editReply({ embeds: [confirmEmbed] });
    },

    //--------------------------------------------------
    // BUTTON HANDLER
    //--------------------------------------------------

    async buttonHandler(interaction) {
        const channel = interaction.channel;
        const guild = interaction.guild;

        // Sadece bu kategorideki kanallarda çalışsın
        if (channel.parentId !== CATEGORY_ID) return;

        //--------------------------------------------------
        // CLOSE
        //--------------------------------------------------

        if (interaction.customId === 'close_ticket') {

            // Kanalı kapat — tüm takım üyelerinin yazmasını engelle
            const teamRoleName = channel.name.replace('radio-', '');
            const teamRole = guild.roles.cache.find(r => slugify(r.name) === teamRoleName);

            if (teamRole) {
                await channel.permissionOverwrites.edit(teamRole.id, {
                    SendMessages: false
                });
            }

            // Butonu güncelle
            const closedEmbed = new EmbedBuilder()
                .setColor(0xED4245) // Discord kırmızısı
                .setTitle('🔒 Channel Closed')
                .setDescription(
                    `This radio channel was closed by <@${interaction.user.id}>.\n\n` +
                    `It will be **automatically deleted in 1 hour**.\n` +
                    `Use **Reopen** to restore access.`
                )
                .setTimestamp();

            await interaction.update({
                embeds: [closedEmbed],
                components: [buildControlRow(true)]
            });

            // 1 saat sonra sil
            setTimeout(() => {
                channel.delete().catch(() => {});
            }, 60 * 60 * 1000);
        }

        //--------------------------------------------------
        // REOPEN
        //--------------------------------------------------

        else if (interaction.customId === 'reopen_ticket') {

            const teamRoleName = channel.name.replace('radio-', '');
            const teamRole = guild.roles.cache.find(r => slugify(r.name) === teamRoleName);

            if (teamRole) {
                await channel.permissionOverwrites.edit(teamRole.id, {
                    SendMessages: true
                });
            }

            // Orijinal panele geri dön
            const member = guild.members.cache.find(m =>
                channel.topic?.includes(m.user.tag)
            ) || interaction.member;

            const embed = buildPanelEmbed(member, teamRole || { name: channel.name });
            const row = buildControlRow(false);

            await interaction.update({
                embeds: [embed],
                components: [row]
            });
        }
    }
};
