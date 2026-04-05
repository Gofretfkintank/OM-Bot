//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const sharp = require('sharp');

//--------------------------------
// OVERALL CALC
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

//--------------------------------
// COLOR
//--------------------------------
function overallColor(pct) {
    if (pct >= 75) return '#00E676';
    if (pct >= 50) return '#FFEB3B';
    if (pct >= 25) return '#FF9800';
    return '#F44336';
}

//--------------------------------
// RING
//--------------------------------
function ringPath(cx, cy, r, pct, color) {
    const circumference = 2 * Math.PI * r;
    const dash = (pct / 100) * circumference;
    const f = 'font-family="DejaVu Sans,sans-serif"';

    return `
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2a2a3a" stroke-width="10"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}"
stroke-linecap="round"
transform="rotate(-90 ${cx} ${cy})"/>
<text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="${color}" font-size="26" font-weight="bold" ${f}>${pct}</text>
<text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="#888" font-size="13" ${f}>OVERALL</text>`;
}

//--------------------------------
// STAT ROW
//--------------------------------
function statRow(y, label, v1, v2, winner) {
    const c1 = winner === 'left'  ? '#00E676' : winner === 'tie' ? '#FFEB3B' : '#aaaaaa';
    const c2 = winner === 'right' ? '#00E676' : winner === 'tie' ? '#FFEB3B' : '#aaaaaa';
    const f = 'font-family="DejaVu Sans,sans-serif"';

    return `
<text x="175" y="${y}" text-anchor="end" fill="${c1}" font-size="18" ${f} font-weight="bold">${v1}</text>
<text x="350" y="${y}" text-anchor="middle" fill="#888" font-size="14" ${f}>${label}</text>
<text x="525" y="${y}" text-anchor="start" fill="${c2}" font-size="18" ${f} font-weight="bold">${v2}</text>`;
}

//--------------------------------
// SVG
//--------------------------------
function buildSVG(u1, d1, ov1, u2, d2, ov2) {
    const f = 'font-family="DejaVu Sans,sans-serif"';
    const col1 = overallColor(ov1);
    const col2 = overallColor(ov2);

    function cmp(a, b) { return a > b ? 'left' : b > a ? 'right' : 'tie'; }

    const r1 = d1.races   || 0, r2 = d2.races   || 0;
    const w1 = d1.wins    || 0, w2 = d2.wins    || 0;
    const p1 = d1.podiums || 0, p2 = d2.podiums || 0;
    const po1= d1.poles   || 0, po2= d2.poles   || 0;
    const dn1= d1.dnf     || 0, dn2= d2.dnf     || 0;
    const wdc1= d1.wdc    || 0, wdc2= d2.wdc    || 0;

    return `<?xml version="1.0"?>
<svg width="700" height="560" xmlns="http://www.w3.org/2000/svg">

<rect width="700" height="560" fill="#12121f"/>

<text x="350" y="40" text-anchor="middle" fill="#E10600" font-size="22" font-weight="bold" ${f}>VS</text>

<text x="175" y="90" text-anchor="middle" fill="${col1}" font-size="26" font-weight="bold" ${f}>${u1.username}</text>
<text x="525" y="90" text-anchor="middle" fill="${col2}" font-size="26" font-weight="bold" ${f}>${u2.username}</text>

${ringPath(175, 195, 60, ov1, col1)}
${ringPath(525, 195, 60, ov2, col2)}

${statRow(315, 'Races',   r1,   r2,   cmp(r1,r2))}
${statRow(345, 'Wins',    w1,   w2,   cmp(w1,w2))}
${statRow(375, 'Podiums', p1,   p2,   cmp(p1,p2))}
${statRow(405, 'Poles',   po1,  po2,  cmp(po1,po2))}
${statRow(435, 'DNF',     dn1,  dn2,  cmp(dn2,dn1))}
${statRow(465, 'WDC',     wdc1, wdc2, cmp(wdc1,wdc2))}

<text x="350" y="540" text-anchor="middle" fill="#555" font-size="12" ${f}>Olzhasstik Motorsports</text>

</svg>`;
}

//--------------------------------
// COMMAND
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Compare two drivers')

        // ✅ BURASI FIX
        .addUserOption(option =>
            option
                .setName('pilot1')
                .setDescription('First driver')
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName('pilot2')
                .setDescription('Second driver')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const u1 = interaction.options.getUser('pilot1');
        const u2 = interaction.options.getUser('pilot2');

        if (u1.id === u2.id)
            return interaction.editReply('❌ Same user');

        const d1 = await Driver.findOne({ userId: u1.id });
        const d2 = await Driver.findOne({ userId: u2.id });

        if (!d1 || !d2)
            return interaction.editReply('❌ Driver not found');

        const ov1 = calcOverall(d1);
        const ov2 = calcOverall(d2);

        const svg = buildSVG(u1, d1, ov1, u2, d2, ov2);
        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        return interaction.editReply({
            files: [new AttachmentBuilder(png, { name: 'vs.png' })]
        });
    }
};