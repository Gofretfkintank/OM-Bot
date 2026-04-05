//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const axios = require('axios');

//--------------------------------
// SCORE CALCULATION
//--------------------------------
function calculateDriverRating(stats) {
    const totalRaces = stats.races || 0;
    if (totalRaces === 0) return 0;

    const winRatio = (stats.wins || 0) / totalRaces;
    const podiumRatio = (stats.podiums || 0) / totalRaces;
    const poleRatio = (stats.poles || 0) / totalRaces;
    const dnfRatio = (stats.dnf || 0) / totalRaces;
    
    const titleBonus = Math.min(((stats.wdc || 0) + (stats.wcc || 0)) * 3, 15);
    const awardBonus = Math.min((stats.doty || 0) * 2, 10);

    const score = 
        winRatio * 40 + 
        podiumRatio * 25 + 
        poleRatio * 10 + 
        (1 - dnfRatio) * 10 + 
        titleBonus + 
        awardBonus;

    return Math.min(Math.round((score / 110) * 100), 100);
}

function getHexColor(rating) {
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
        .setDescription('Compare two drivers')
        .addUserOption(opt => opt.setName('driver1').setDescription('First Driver').setRequired(true))
        .addUserOption(opt => opt.setName('driver2').setDescription('Second Driver').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const user1 = interaction.options.getUser('driver1');
        const user2 = interaction.options.getUser('driver2');

        if (user1.id === user2.id) return interaction.editReply('❌ Select two different drivers.');

        const driverData1 = await Driver.findOne({ userId: user1.id });
        const driverData2 = await Driver.findOne({ userId: user2.id });

        if (!driverData1 || !driverData2) return interaction.editReply('❌ Drivers not found in the database.');

        const rating1 = calculateDriverRating(driverData1);
        const rating2 = calculateDriverRating(driverData2);

        // Your provided API URL
        const targetUrl = 'https://api.cookie-api.com/api/cards/card-builder/build';

        const requestBody = {
            data: {
                width: 700,
                height: 500,
                background: "#12121f",
                elements: [
                    { type: "rect", x: 349, y: 50, width: 2, height: 400, fill: "#2a2a3a" },
                    { type: "text", content: "VS", x: 350, y: 40, size: 30, color: "#ffffff", font: "Roboto", align: "center" },
                    
                    // Left Driver
                    { type: "text", content: user1.username.toUpperCase(), x: 175, y: 80, size: 24, color: "#ffffff", font: "Roboto", align: "center" },
                    { type: "circle", x: 175, y: 220, radius: 70, stroke: "#2a2a3a", strokeWidth: 10, fill: "transparent" },
                    { type: "text", content: rating1.toString(), x: 175, y: 220, size: 50, color: getHexColor(rating1), font: "Roboto", align: "center" },
                    
                    // Right Driver
                    { type: "text", content: user2.username.toUpperCase(), x: 525, y: 80, size: 24, color: "#ffffff", font: "Roboto", align: "center" },
                    { type: "circle", x: 525, y: 220, radius: 70, stroke: "#2a2a3a", strokeWidth: 10, fill: "transparent" },
                    { type: "text", content: rating2.toString(), x: 525, y: 220, size: 50, color: getHexColor(rating2), font: "Roboto", align: "center" }
                ]
            }
        };

        try {
            const apiResponse = await axios.post(targetUrl, requestBody, {
                headers: {
                    'Authorization': process.env.COOKIE_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            });

            const finalBuffer = Buffer.from(apiResponse.data);
            const attachment = new AttachmentBuilder(finalBuffer, { name: 'vs.png' });

            return interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error("API Error Status:", error.response?.status);
            // If the URL you provided gives 404, the error will be logged here.
            return interaction.editReply(`❌ API Error: ${error.response?.status || 'Failed to connect'}`);
        }
    }
};
