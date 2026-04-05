//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const axios = require('axios');

//--------------------------------
// HELPER FUNCTIONS
//--------------------------------
function calcOverall(d) {
    const races = d.races || 0;
    if (races === 0) return 0;

    const winRate = (d.wins || 0) / races;
    const podRate = (d.podiums || 0) / races;
    const poleRate = (d.poles || 0) / races;
    const dnfRate = (d.dnf || 0) / races;
    const champBonus = Math.min(((d.wdc || 0) + (d.wcc || 0)) * 3, 15);
    const dotyBonus = Math.min((d.doty || 0) * 2, 10);

    const raw = winRate * 40 + podRate * 25 + poleRate * 10 + (1 - dnfRate) * 10 + champBonus + dotyBonus;
    return Math.min(Math.round((raw / 110) * 100), 100);
}

function overallColor(pct) {
    if (pct >= 75) return '#00E676';
    if (pct >= 50) return '#FFEB3B';
    if (pct >= 25) return '#FF9800';
    return '#F44336';
}

//--------------------------------
// SLASH COMMAND
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Compare two drivers')
        .addUserOption(option => 
            option.setName('driver1').setDescription('First driver').setRequired(true))
        .addUserOption(option => 
            option.setName('driver2').setDescription('Second driver').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const u1 = interaction.options.getUser('driver1');
        const u2 = interaction.options.getUser('driver2');

        if (u1.id === u2.id) return interaction.editReply('❌ You cannot compare the same user.');

        const d1 = await Driver.findOne({ userId: u1.id });
        const d2 = await Driver.findOne({ userId: u2.id });

        if (!d1 || !d2) return interaction.editReply('❌ One or both drivers were not found in the database.');

        const ov1 = calcOverall(d1);
        const ov2 = calcOverall(d2);

        // API Payload for Cookie API V2
        const payload = {
            type: "custom",
            data: {
                width: 700,
                height: 500,
                background: "#12121f",
                elements: [
                    // Center Divider
                    { type: "rect", x: 349, y: 50, width: 2, height: 400, fill: "#2a2a3a" },
                    
                    // Headers
                    { type: "text", content: u1.username.toUpperCase(), x: 175, y: 80, size: 24, color: "#ffffff", font: "Roboto", align: "center" },
                    { type: "text", content: "VS", x: 350, y: 40, size: 30, color: "#ffffff", font: "Roboto", align: "center" },
                    { type: "text", content: u2.username.toUpperCase(), x: 525, y: 80, size: 24, color: "#ffffff", font: "Roboto", align: "center" },
                    
                    // Driver 1 Stats
                    { type: "circle", x: 175, y: 220, radius: 70, stroke: "#2a2a3a", strokeWidth: 10, fill: "transparent" },
                    { type: "text", content: ov1.toString(), x: 175, y: 220, size: 50, color: overallColor(ov1), font: "Roboto", align: "center" },
                    
                    // Driver 2 Stats
                    { type: "circle", x: 525, y: 220, radius: 70, stroke: "#2a2a3a", strokeWidth: 10, fill: "transparent" },
                    { type: "text", content: ov2.toString(), x: 525, y: 220, size: 50, color: overallColor(ov2), font: "Roboto", align: "center" },
                    
                    // Footer Stats
                    { type: "text", content: `WDC: ${d1.wdc || 0}`, x: 175, y: 330, size: 18, color: "#aaaaaa", font: "Roboto", align: "center" },
                    { type: "text", content: `WDC: ${d2.wdc || 0}`, x: 525, y: 330, size: 18, color: "#aaaaaa", font: "Roboto", align: "center" }
                ]
            }
        };

        try {
            const response = await axios.post('https://api.cookie-api.com/v2/generator', payload, {
                headers: {
                    'Authorization': process.env.COOKIE_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            });

            const attachment = new AttachmentBuilder(Buffer.from(response.data), { name: 'vs-stats.png' });
            return interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error("API Error Status:", error.response?.status);
            return interaction.editReply(`❌ Image generation failed. (Error: ${error.response?.status || 'Connection'})`);
        }
    }
};
