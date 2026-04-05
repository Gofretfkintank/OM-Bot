//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const Driver = require('../models/Driver');
const axios = require('axios');

//--------------------------------
// HELPER FUNCTIONS
//--------------------------------
function calcOverall(d) {
    const races = d.races || 0;
    if (races === 0) return 0;

    const winRate  = (d.wins    || 0) / races;
    const podRate  = (d.podiums || 0) / races;
    const poleRate = (d.poles   || 0) / races;
    const dnfRate  = (d.dnf     || 0) / races;
    const champBonus = Math.min(((d.wdc || 0) + (d.wcc || 0)) * 3, 15);
    const dotyBonus  = Math.min((d.doty || 0) * 2, 10);

    const raw =
        winRate  * 40 +
        podRate  * 25 +
        poleRate * 10 +
        (1 - dnfRate) * 10 +
        champBonus +
        dotyBonus;

    return Math.min(Math.round((raw / 110) * 100), 100);
}

function overallColor(pct) {
    if (pct >= 75) return '#00E676';
    if (pct >= 50) return '#FFEB3B';
    if (pct >= 25) return '#FF9800';
    return '#F44336';
}

//--------------------------------
// BUILD BASE IMAGE (FONT OLMADAN)
//--------------------------------
function buildImageWithoutFont(d1, ov1, d2, ov2) {
    const W = 700, H = 560;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#12121f';
    ctx.fillRect(0, 0, W, H);

    // Middle line
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(350, 60);
    ctx.lineTo(350, 490);
    ctx.stroke();

    // Rings (without numbers)
    function drawRing(ctx, cx, cy, r, pct, color) {
        const startAngle = -Math.PI / 2;
        const endAngle   = startAngle + (pct / 100) * 2 * Math.PI;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 10;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';
    }

    drawRing(ctx, 175, 195, 60, ov1, overallColor(ov1));
    drawRing(ctx, 525, 195, 60, ov2, overallColor(ov2));

    return canvas.toBuffer('image/png');
}

//--------------------------------
// COOKIE API FONT OVERLAY
//--------------------------------
async function addFontWithCookieAPI(baseImage, textOverlays) {
    // Cookie API endpoint (gerçek dokümanına göre değiştir)
    const response = await axios.post(
        'https://api.cookie-api.com/api/ai/generate-image',
        {
            image: baseImage.toString('base64'),
            text: textOverlays,
            font: 'Roboto',
            fontSize: 28,
            color: '#ffffff'
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.COOKIE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    // API base64 döner
    return Buffer.from(response.data.image, 'base64');
}

//--------------------------------
// SLASH COMMAND
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Compare two drivers')
        .addUserOption(option =>
            option.setName('pilot1')
                  .setDescription('First driver')
                  .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('pilot2')
                  .setDescription('Second driver')
                  .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const u1 = interaction.options.getUser('pilot1');
        const u2 = interaction.options.getUser('pilot2');

        if (u1.id === u2.id)
            return interaction.editReply('❌ Cannot compare the same user');

        const d1 = await Driver.findOne({ userId: u1.id });
        const d2 = await Driver.findOne({ userId: u2.id });

        if (!d1 || !d2)
            return interaction.editReply('❌ One or both drivers not found');

        const ov1 = calcOverall(d1);
        const ov2 = calcOverall(d2);

        // 1️⃣ Canvas ile temel görsel (fontsuz)
        const baseCanvas = buildImageWithoutFont(d1, ov1, d2, ov2);

        // 2️⃣ Fontlu yazılar için Cookie API
        const finalImage = await addFontWithCookieAPI(baseCanvas, [
            { x: 175, y: 80, content: u1.username },
            { x: 525, y: 80, content: u2.username },
            { x: 350, y: 35, content: 'VS' },
            { x: 175, y: 195, content: ov1.toString() },
            { x: 525, y: 195, content: ov2.toString() }
        ]);

        // 3️⃣ Discord’a gönder
        return interaction.editReply({
            files: [new AttachmentBuilder(finalImage, { name: 'vs.png' })]
        });
    }
};