//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const axios = require('axios');

//--------------------------------
// HELPER FUNCTIONS
//--------------------------------
function calculateOverall(stats) {
    const races = stats.races || 0;
    if (races === 0) return 0;

    const winRate = (stats.wins || 0) / races;
    const podiumRate = (stats.podiums || 0) / races;
    const poleRate = (stats.poles || 0) / races;
    const dnfRate = (stats.dnf || 0) / races;
    
    // Logic for Racing League Bonuses
    const championshipBonus = Math.min(((stats.wdc || 0) + (stats.wcc || 0)) * 3, 15);
    const dotyBonus = Math.min((stats.doty || 0) * 2, 10);

    const rawScore = 
        winRate * 40 + 
        podiumRate * 25 + 
        poleRate * 10 + 
        (1 - dnfRate) * 10 + 
        championshipBonus + 
        dotyBonus;

    return Math.min(Math.round((rawScore / 110) * 100), 100);
}

function getRatingColor(pct) {
    if (pct >= 75) return '#00E676'; // Legendary
    if (pct >= 50) return '#FFEB3B'; // Pro
    if (pct >= 25) return '#FF9800'; // Amateur
    return '#F44336'; // Rookie
}

//--------------------------------
// COMMAND DEFINITION
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Compare two drivers on track')
        .addUserOption(opt => opt.setName('driver1').setDescription('First Driver').setRequired(true))
        .addUserOption(opt => opt.setName('driver2').setDescription('Second Driver').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const user1 = interaction.options.getUser('driver1');
        const user2 = interaction.options.getUser('driver2');

        if (user1.id === user2.id) return interaction.editReply('❌ Comparison requires two different drivers.');

        const data1 = await Driver.findOne({ userId: user1.id });
        const data2 = await Driver.findOne({ userId: user2.id });

        if (!data1 || !data2) return interaction.editReply('❌ One or both drivers not found in database.');

        const rating1 = calculateOverall(data1);
        const rating2 = calculateOverall(data2);

        // API Payload for Cookie API V2 Builder
        const apiPayload = {
            type: "custom",
            data: {
                width: 700,
                height: 500,
                background: "#12121f",
                elements: [
                    // Layout Elements
                    { type: "rect", x: 349, y: 50, width: 2, height: 400, fill: "#2a2a3a" },
                    { type: "text", content: "VS", x: 350, y: 40, size: 30, color: "#ffffff", font: "Roboto", align: "center" },
                    
                    // Driver 1 Section
                    { type: "text", content: user1.username.toUpperCase(), x: 175, y: 80, size: 24, color: "#ffffff", font: "Roboto", align: "center" },
                    { type: "circle", x: 175, y: 220, radius: 70, stroke: "#2a2a3a", strokeWidth: 10, fill: "transparent" },
                    { type: "text", content: rating1.toString(), x: 175, y: 220, size: 50, color: getRatingColor(rating1), font: "Roboto", align: "center" },
                    
                    // Driver 2 Section
                    { type: "text", content: user2.username.toUpperCase(), x: 525, y: 80, size: 24, color: "#ffffff", font: "Roboto", align: "center" },
                    { type: "circle", x: 525, y: 220, radius: 70, stroke: "#2a2a3a", strokeWidth: 10, fill: "transparent" },
                    { type: "text", content: rating2.toString(), x: 525, y: 220, size: 50, color: getRatingColor(rating2), font: "Roboto", align: "center" }
                ]
            }
        };

        try {
            const apiResponse = await axios.post('https://api.cookie-api.com/v2/builder', apiPayload, {
                headers: {
                    'Authorization': process.env.COOKIE_API_KEY, // Use raw key first, add 'Bearer ' if 401 occurs
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            });

            const imageFile = new AttachmentBuilder(Buffer.from(apiResponse.data), { name: 'comparison.png' });
            return interaction.editReply({ files: [imageFile] });

        } catch (err) {
            console.error("API CALL FAILED:", err.response?.status || err.message);
            return interaction.editReply(`❌ API Error: ${err.response?.status || 'Connection Problem'}`);
        }
    }
};
