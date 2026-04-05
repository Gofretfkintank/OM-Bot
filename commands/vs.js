//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const axios = require('axios');

//--------------------------------
// RATING CALCULATION
//--------------------------------
function calculateDriverRating(stats) {
    const totalRaces = stats.races || 0;
    if (totalRaces === 0) return 0;

    const winRatio    = (stats.wins    || 0) / totalRaces;
    const podiumRatio = (stats.podiums || 0) / totalRaces;
    const poleRatio   = (stats.poles   || 0) / totalRaces;
    const dnfRatio    = (stats.dnf     || 0) / totalRaces;

    const titleBonus = Math.min(((stats.wdc || 0) + (stats.wcc || 0)) * 3, 15);
    const awardBonus = Math.min((stats.doty || 0) * 2, 10);

    const score =
        winRatio    * 40 +
        podiumRatio * 25 +
        poleRatio   * 10 +
        (1 - dnfRatio) * 10 +
        titleBonus +
        awardBonus;

    return Math.min(Math.round((score / 110) * 100), 100);
}

function getRatingColor(rating) {
    if (rating >= 75) return '#00E676';
    if (rating >= 50) return '#FFEB3B';
    if (rating >= 25) return '#FF9800';
    return '#F44336';
}

//--------------------------------
// COMMAND EXECUTION
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Compare two drivers head to head')
        .addUserOption(opt => opt.setName('driver1').setDescription('First Driver').setRequired(true))
        .addUserOption(opt => opt.setName('driver2').setDescription('Second Driver').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const user1 = interaction.options.getUser('driver1');
        const user2 = interaction.options.getUser('driver2');

        if (user1.id === user2.id)
            return interaction.editReply('❌ Please select two different drivers.');

        const [driverData1, driverData2] = await Promise.all([
            Driver.findOne({ userId: user1.id }),
            Driver.findOne({ userId: user2.id }),
        ]);

        if (!driverData1 || !driverData2)
            return interaction.editReply('❌ One or both drivers were not found in the database.');

        const rating1 = calculateDriverRating(driverData1);
        const rating2 = calculateDriverRating(driverData2);

        const color1 = getRatingColor(rating1);
        const color2 = getRatingColor(rating2);

        // ------------------------------------------------
        // COOKIE API — correct payload format per docs
        // ------------------------------------------------
        const requestBody = {
            card: {
                height: "260",
                width: "700",
                bg: "#0d0d1a",
                bg_type: "color"
            },
            elements: [
                // ---- Divider line (thin rect via image trick not supported — use colored text as separator) ----

                // ---- Left name ----
                {
                    id: "left-name",
                    type: "text",
                    text: user1.username.toUpperCase(),
                    text_size: "22",
                    font: "Roboto",
                    color: "#ffffff",
                    transparency: "100",
                    layer: "2",
                    position: { x: 10, y: 20 },
                    size: { width: 300, height: 40 }
                },
                // ---- Right name ----
                {
                    id: "right-name",
                    type: "text",
                    text: user2.username.toUpperCase(),
                    text_size: "22",
                    font: "Roboto",
                    color: "#ffffff",
                    transparency: "100",
                    layer: "2",
                    position: { x: 390, y: 20 },
                    size: { width: 300, height: 40 }
                },
                // ---- VS label ----
                {
                    id: "vs-label",
                    type: "text",
                    text: "VS",
                    text_size: "28",
                    font: "Roboto",
                    color: "#aaaaaa",
                    transparency: "100",
                    layer: "2",
                    position: { x: 320, y: 15 },
                    size: { width: 60, height: 50 }
                },
                // ---- Left rating ----
                {
                    id: "left-rating",
                    type: "text",
                    text: rating1.toString(),
                    text_size: "60",
                    font: "Roboto",
                    color: color1,
                    transparency: "100",
                    layer: "2",
                    position: { x: 10, y: 80 },
                    size: { width: 300, height: 80 }
                },
                // ---- Right rating ----
                {
                    id: "right-rating",
                    type: "text",
                    text: rating2.toString(),
                    text_size: "60",
                    font: "Roboto",
                    color: color2,
                    transparency: "100",
                    layer: "2",
                    position: { x: 390, y: 80 },
                    size: { width: 300, height: 80 }
                },
                // ---- Left stats ----
                {
                    id: "left-stats",
                    type: "text",
                    text: `Races: ${driverData1.races}  Wins: ${driverData1.wins}  Podiums: ${driverData1.podiums}`,
                    text_size: "14",
                    font: "Roboto",
                    color: "#aaaaaa",
                    transparency: "100",
                    layer: "2",
                    position: { x: 10, y: 175 },
                    size: { width: 330, height: 30 }
                },
                // ---- Right stats ----
                {
                    id: "right-stats",
                    type: "text",
                    text: `Races: ${driverData2.races}  Wins: ${driverData2.wins}  Podiums: ${driverData2.podiums}`,
                    text_size: "14",
                    font: "Roboto",
                    color: "#aaaaaa",
                    transparency: "100",
                    layer: "2",
                    position: { x: 390, y: 175 },
                    size: { width: 330, height: 30 }
                },
                // ---- Left poles/DNF ----
                {
                    id: "left-extra",
                    type: "text",
                    text: `Poles: ${driverData1.poles}  DNF: ${driverData1.dnf}  WDC: ${driverData1.wdc}`,
                    text_size: "14",
                    font: "Roboto",
                    color: "#aaaaaa",
                    transparency: "100",
                    layer: "2",
                    position: { x: 10, y: 210 },
                    size: { width: 330, height: 30 }
                },
                // ---- Right poles/DNF ----
                {
                    id: "right-extra",
                    type: "text",
                    text: `Poles: ${driverData2.poles}  DNF: ${driverData2.dnf}  WDC: ${driverData2.wdc}`,
                    text_size: "14",
                    font: "Roboto",
                    color: "#aaaaaa",
                    transparency: "100",
                    layer: "2",
                    position: { x: 390, y: 210 },
                    size: { width: 330, height: 30 }
                },
            ]
        };

        try {
            // Cookie API returns a JSON with a "url" field — NOT a binary image
            const apiResponse = await axios.post(
                'https://api.cookie-api.com/api/cards/card-builder/build',
                requestBody,
                {
                    headers: {
                        'Authorization': process.env.COOKIE_API_KEY,
                        'Content-Type': 'application/json'
                    }
                    // No responseType: 'arraybuffer' — we need JSON back
                }
            );

            const result = apiResponse.data;

            if (!result.success) {
                console.error('Cookie API error:', JSON.stringify(result));
                return interaction.editReply(`❌ Card generation failed: ${result.errors?.[0]?.message || 'Unknown error'}`);
            }

            // API returns an image URL — send it as an embed
            const embed = new EmbedBuilder()
                .setTitle(`${user1.username} vs ${user2.username}`)
                .setImage(result.url)
                .setColor(rating1 >= rating2 ? color1 : color2)
                .setFooter({ text: 'Olzhasstik Motorsports' });

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const errBody = error.response?.data;
            console.error('VS command error:', typeof errBody === 'object' ? JSON.stringify(errBody) : errBody);
            return interaction.editReply(`❌ API Error ${error.response?.status || ''}: ${errBody?.errors?.[0]?.message || 'Failed to connect'}`);
        }
    }
};
