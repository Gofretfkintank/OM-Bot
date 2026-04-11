//--------------------------//
// IMPORTS
//--------------------------//
const {
    SlashCommandBuilder,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events
} = require('discord.js');

//--------------------------//
// CONFIG
//--------------------------//
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

//--------------------------//
// COMMAND EXPORT
//--------------------------//
module.exports = {
    data: new SlashCommandBuilder()
        .setName('teamradio')
        .setDescription('Open a private team radio ticket'),

    async execute(interaction) {

        const member = interaction.member;
        const guild = interaction.guild;

        //--------------------------//
        // TEAM ROLE
        //--------------------------//
        const teamRole = member.roles.cache.find(r => TEAMS.includes(r.name));

        if (!teamRole) {
            return interaction.reply({
                content: "❌ You don't have a valid team role.",
                ephemeral: true
            });
        }

        //--------------------------//
        // EXISTING TICKET
        //--------------------------//
        const existing = guild.channels.cache.find(c =>
            c.name.startsWith(`teamradio-${teamRole.name.toLowerCase().replace(/\s+/g, '-')}`) &&
            c.topic === member.id
        );

        if (existing) {
            if (existing.permissionOverwrites.cache.get(member.id)?.deny.has("SendMessages")) {
                await existing.delete().catch(() => {});
            } else {
                return interaction.reply({
                    content: "❌ You already have an open ticket.",
                    ephemeral: true
                });
            }
        }

        //--------------------------//
        // CREATE CHANNEL
        //--------------------------//
        const channelName = `teamradio-${teamRole.name.toLowerCase().replace(/\s+/g, '-')}`;

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            topic: member.id,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: ['ViewChannel']
                },
                {
                    id: teamRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                },
                {
                    id: member.id,
                    allow: ['ViewChannel', 'SendMessages']
                }
            ]
        });

        //--------------------------//
        // BUTTONS
        //--------------------------//
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId('reopen_ticket')
                .setLabel('Reopen Ticket')
                .setStyle(ButtonStyle.Success)
        );

        //--------------------------//
        // MESSAGE
        //--------------------------//
        await channel.send({
            content: `📡 **Team Radio Opened**

This ticket is for internal team communication.

Only your team members can access this channel.

Use the buttons below to manage the ticket.`,
            components: [row]
        });

        await interaction.reply({
            content: `✅ Ticket created: ${channel}`,
            ephemeral: true
        });
    },

    //--------------------------//
    // BUTTON HANDLER (INLINE)
    //--------------------------//
    async buttonHandler(interaction) {

        if (!interaction.isButton()) return;

        const channel = interaction.channel;

        //--------------------------//
        // CLOSE
        //--------------------------//
        if (interaction.customId === 'close_ticket') {

            await channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: false
            });

            await interaction.reply({
                content: "🔒 Ticket closed. It will be deleted in 1 hour."
            });

            setTimeout(() => {
                if (channel) channel.delete().catch(() => {});
            }, 60 * 60 * 1000);
        }

        //--------------------------//
        // REOPEN
        //--------------------------//
        if (interaction.customId === 'reopen_ticket') {

            await channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: true
            });

            await interaction.reply({
                content: "🔓 Ticket reopened."
            });
        }
    }
};