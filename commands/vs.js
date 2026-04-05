const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const sharp = require('sharp');

function calcOverall(d) {
    const races = d.races || 0;
    if (races === 0) return 0;
    const winRate = (d.wins || 0) / races;
    const podRate = (d.podiums || 0) / races;
    const poleRate = (d.poles || 0) / races;
    const dnfRate = (d.dnf || 0) / races;
    const bonus = Math.min(((d.wdc || 0) + (d.wcc || 0)) * 3 + (d.doty || 0) * 2, 25);
    const raw = (winRate * 40 + podRate * 25 + poleRate * 10 + (1 - dnfRate) * 10 + bonus);
    return Math.min(Math.round((raw / 110) * 100), 100);
}

function overallColor(pct) {
    if (pct >= 75) return '#00E676';
    if (pct >= 50) return '#FFEB3B';
    return '#F44336';
}

function buildSVG(u1, d1, ov1, u2, d2, ov2) {
    const col1 = overallColor(ov1);
    const col2 = overallColor(ov2);
    const cmp = (a, b) => a > b ? ['#00E676', '#aaaaaa'] : a < b ? ['#aaaaaa', '#00E676'] : ['#FFEB3B', '#FFEB3B'];
    
    const [cW1, cW2] = cmp(d1.wins||0, d2.wins||0);
    const [cP1, cP2] = cmp(d1.podiums||0, d2.podiums||0);
    const font = 'font-family="DejaVu Sans, sans-serif"';

    return `<svg width="700" height="520" xmlns="http://www.w3.org/2000/svg">
    <rect width="700" height="520" fill="#12121f" rx="15"/>
    <text x="350" y="40" text-anchor="middle" fill="#E10600" font-size="24" ${font} font-weight="bold">VS</text>
    
    <text x="175" y="100" text-anchor="middle" fill="#fff" font-size="20" ${font}>${u1.username}</text>
    <text x="175" y="160" text-anchor="middle" fill="${col1}" font-size="45" ${font} font-weight="bold">${ov1}</text>
    
    <text x="525" y="100" text-anchor="middle" fill="#fff" font-size="20" ${font}>${u2.username}</text>
    <text x="525" y="160" text-anchor="middle" fill="${col2}" font-size="45" ${font} font-weight="bold">${ov2}</text>

    <text x="350" y="300" text-anchor="middle" fill="#888" font-size="16" ${font}>WINS</text>
    <text x="175" y="300" text-anchor="middle" fill="${cW1}" font-size="20" ${font}>${d1.wins||0}</text>
    <text x="525" y="300" text-anchor="middle" fill="${cW2}" font-size="20" ${font}>${d2.wins||0}</text>

    <text x="350" y="350" text-anchor="middle" fill="#888" font-size="16" ${font}>PODIUMS</text>
    <text x="175" y="350" text-anchor="middle" fill="${cP1}" font-size="20" ${font}>${d1.podiums||0}</text>
    <text x="525" y="350" text-anchor="middle" fill="${cP2}" font-size="20" ${font}>${d2.podiums||0}</text>
</svg>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Pilot karşılaştır')
        .addUserOption(o => o.setName('p1').setDescription('Pilot 1').setRequired(true))
        .addUserOption(o => o.setName('p2').setDescription('Pilot 2').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const u1 = interaction.options.getUser('p1');
        const u2 = interaction.options.getUser('p2');
        const d1 = await Driver.findOne({ userId: u1.id });
        const d2 = await Driver.findOne({ userId: u2.id });

        if (!d1 || !d2) return interaction.editReply("Pilotlardan biri bulunamadı.");

        const ov1 = calcOverall(d1);
        const ov2 = calcOverall(d2);
        const svg = buildSVG(u1, d1, ov1, u2, d2, ov2);
        
        const png = await sharp(Buffer.from(svg)).png().toBuffer();
        await interaction.editReply({ files: [new AttachmentBuilder(png, { name: 'vs.png' })] });
    }
};
