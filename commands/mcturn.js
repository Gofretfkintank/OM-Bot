//--------------------------------
// /mcturn
// Toggles the Exaroton Minecraft server on or off.
// Automatically fetches server ID from API.
// Staff-only command.
//--------------------------------

const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const axios = require('axios');

//--------------------------------
// CONFIG
//--------------------------------
const API     = 'https://api.exaroton.com/v1';
const HEADERS = () => ({ Authorization: `Bearer ${process.env.EXAROTON_API_KEY}` });
const MC_STATUS_CHANNEL = '1511995662865141810';

const STATUS_LABEL = {
    0:  'Offline',
    1:  'Online',
    2:  'Starting',
    3:  'Stopping',
    4:  'Restarting',
    5:  'Saving',
    6:  'Loading',
    7:  'Crashed',
    8:  'Pending',
    10: 'Preparing'
};

//--------------------------------
// HELPERS
//--------------------------------
function errorEmbed(title, desc) {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(title)
        .setDescription(desc)
        .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
        .setTimestamp();
}

function warningEmbed(title, desc) {
    return new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle(title)
        .setDescription(desc)
        .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
        .setTimestamp();
}

//--------------------------------
// MAIN EXPORT
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcturn')
        .setDescription('Toggle the Minecraft server on or off'),

    async execute(interaction) {

        // Staff only
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
        }

        await interaction.deferReply();

        // Fetch server list and grab first server
        let server;
        try {
            const res = await axios.get(`${API}/servers/`, { headers: HEADERS() });
            const servers = res.data.data;
            if (!servers || servers.length === 0) {
                return interaction.editReply({ embeds: [errorEmbed('❌ No Servers Found', 'No servers found on this Exaroton account.')] });
            }
            server = servers[0];
        } catch (err) {
            return interaction.editReply({
                embeds: [errorEmbed('❌ Connection Failed', `\`${err.message}\`\nCheck **EXAROTON_API_KEY** in Railway Variables.`)]
            });
        }

        const { id: serverId, status, address } = server;
        const statusLabel = STATUS_LABEL[status] || 'Unknown';

        // Block mid-transition states (not Online or Offline)
        if (status !== 0 && status !== 1) {
            return interaction.editReply({
                embeds: [warningEmbed(`⏳ Server is ${statusLabel}`, 'Wait for the current operation to finish before toggling.')]
            });
        }

        const turningOn = status === 0;

        // Send start or stop request
        try {
            await axios.get(`${API}/servers/${serverId}/${turningOn ? 'start' : 'stop'}/`, { headers: HEADERS() });
        } catch (err) {
            return interaction.editReply({
                embeds: [errorEmbed('❌ Action Failed', `\`${err.message}\``)]
            });
        }

        // Success embed
        const embed = new EmbedBuilder()
            .setColor(turningOn ? 0x2ECC71 : 0xE74C3C)
            .setTitle(turningOn ? '🟢 Server Starting' : '🔴 Server Stopping')
            .setDescription(turningOn
                ? `Booting up. Check <#${MC_STATUS_CHANNEL}> when ready.`
                : 'Server is shutting down.')
            .addFields(
                { name: '🌐 Address',      value: `\`${address}\``,                          inline: true },
                { name: '👤 Triggered by', value: `<@${interaction.user.id}>`,                inline: true },
                { name: '⏱️ Time',         value: `<t:${Math.floor(Date.now() / 1000)}:R>`,  inline: true }
            )
            .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};
