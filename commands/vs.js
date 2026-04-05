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
    return `
<circle cx="${cx}" cy="${cy}" r="${r}"
  fill="none" stroke="#2a2a3a" stroke-width="10"/>
<circle cx="${cx}" cy="${cy}" r="${r}"
  fill="none" stroke="${color}" stroke-width="10"
  stroke-dasharray="${dash.toFixed(2)} ${circumference.toFixed(2)}"
  stroke-linecap="round"
  transform="rotate(-90 ${cx} ${cy})"/>`;
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
<text x="350" y="${y}" text-anchor="middle" fill="#888888" font-size="14" ${f}>${label}</text>
<text x="525" y="${y}" text-anchor="start" fill="${c2}" font-size="18" ${f} font-weight="bold">${v2}</text>`;
}

//--------------------------------
// SVG BUILDER
//--------------------------------
function buildSVG(u1, d1, ov1, u2, d2, ov2) {
    const W = 700, H = 520;
    const col1 = overallColor(ov1);
    const col2 = overallColor(ov2);
    const r = 60;
    const f = 'font-family="DejaVu Sans,sans-serif"';

    const cmp = (a, b) => a > b ? ['left','right'] : a < b ? ['right','left'] : ['tie','tie'];

    const winnerRaces = cmp(d1.races||0, d2.races||0);
    const winnerWins  = cmp(d1.wins||0, d2.wins||0);
    const winnerPod   = cmp(d1.podiums||0, d2.podiums||0);
    const winnerPoles = cmp(d1.poles||0, d2.poles||0);
    const winnerDNF   = cmp(d2.dnf||0, d1.dnf||0);
    const winnerChamp = cmp((d1.wdc||0)+(d1.wcc||0), (d2.wdc||0)+(d2.wcc||0));

    const rate1 = d1.races > 0 ? ((d1.wins||0)/d1.races*100).toFixed(1) : '0.0';
    const rate2 = d2.races > 0 ? ((d2.wins||0)/d2.races*100).toFixed(1) : '0.0';
    const winnerRate = cmp(parseFloat(rate1), parseFloat(rate2));

    const ini1 = u1.username.charAt(0).toUpperCase();
    const ini2 = u2.username.charAt(0).toUpperCase();

    const vsLabel = ov1 > ov2 ? `${u1.username} wins`
                  : ov2 > ov1 ? `${u2.username} wins`
                  : 'Tied!';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">

<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#12121f"/>
    <stop offset="100%" stop-color="#1a1a2e"/>
  </linearGradient>
</defs>

<rect width="${W}" height="${H}" fill="url(#bg)" rx="18"/>

<text x="350" y="40" text-anchor="middle" fill="#E10600" font-size="20" ${f} font-weight="900">VS</text>

<!-- LEFT -->
<text x="175" y="100" text-anchor="middle" fill="${col1}" font-size="32" ${f}>${ini1}</text>
<text x="175" y="140" text-anchor="middle" fill="#fff" font-size="16" ${f}>${u1.username}</text>

${ringPath(175, 210, r, ov1, col1)}

<!-- RIGHT -->
<text x="525" y="100" text-anchor="middle" fill="${col2}" font-size="32" ${f}>${ini2}</text>
<text x="525" y="140" text-anchor="middle" fill="#fff" font-size="16" ${f}>${u2.username}</text>

${ringPath(525, 210, r, ov2, col2)}

${statRow(300,'Races',d1.races||0,d2.races||0,winnerRaces[0])}
${statRow(330,'Wins',d1.wins||0,d2.wins||0,winnerWins[0])}
${statRow(360,'Podiums',d1.podiums||0,d2.podiums||0,winnerPod[0])}
${statRow(390,'Poles',d1.poles||0,d2.poles||0,winnerPoles[0])}
${statRow(420,'Win Rate',rate1+'%',rate2+'%',winnerRate[0])}
${statRow(450,'DNF',d1.dnf||0,d2.dnf||0,winnerDNF[0])}
${statRow(480,'Championships',(d1.wdc||0)+(d1.wcc||0),(d2.wdc||0)+(d2.wcc||0),winnerChamp[0])}

<text x="350" y="510" text-anchor="middle" fill="#E10600" font-size="14" ${f}>
&#x1F3C1; ${vsLabel}
</text>

</svg>`;
}

//--------------------------------
// COMMAND
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Compare two drivers')
        .addUserOption(o=>o.setName('pilot1').setRequired(true))
        .addUserOption(o=>o.setName('pilot2').setRequired(true)),

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