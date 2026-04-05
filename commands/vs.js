//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const { createCanvas } = require('canvas');

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
// DRAW RING
//--------------------------------
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

    // Font düzeltmesi
    ctx.fillStyle = color;
    ctx.font = 'bold 28px DejaVu Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pct), cx, cy - 8);

    ctx.fillStyle = '#888888';
    ctx.font = '13px DejaVu Sans';
    ctx.fillText('OVERALL', cx, cy + 16);
}

//--------------------------------
// DRAW STAT ROW
//--------------------------------
function drawStatRow(ctx, y, label, v1, v2, winner) {
    const c1 = winner === 'left'  ? '#00E676' : winner === 'tie' ? '#FFEB3B' : '#aaaaaa';
    const c2 = winner === 'right' ? '#00E676' : winner === 'tie' ? '#FFEB3B' : '#aaaaaa';

    ctx.textBaseline = 'middle';

    ctx.fillStyle = c1;
    ctx.font = 'bold 18px DejaVu Sans';
    ctx.textAlign = 'right';
    ctx.fillText(String(v1), 175, y);

    ctx.fillStyle = '#888888';
    ctx.font = '14px DejaVu Sans';
    ctx.textAlign = 'center';
    ctx.fillText(label, 350, y);

    ctx.fillStyle = c2;
    ctx.font = 'bold 18px DejaVu Sans';
    ctx.textAlign = 'left';
    ctx.fillText(String(v2), 525, y);
}

//--------------------------------
// BUILD IMAGE
//--------------------------------
function buildImage(u1, d1, ov1, u2, d2, ov2) {
    const W = 700, H = 560;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    const col1 = overallColor(ov1);
    const col2 = overallColor(ov2);

    function cmp(a, b) { return a > b ? 'left' : b > a ? 'right' : 'tie'; }

    ctx.fillStyle = '#12121f';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(350, 60);
    ctx.lineTo(350, 490);
    ctx.stroke();

    // VS yazısı
    ctx.fillStyle = '#E10600';
    ctx.font = 'bold 22px DejaVu Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', 350, 35);

    // Kullanıcı isimleri
    ctx.fillStyle = col1;
    ctx.font = 'bold 22px DejaVu Sans';
    ctx.textAlign = 'center';
    ctx.fillText(u1.username, 175, 80);

    ctx.fillStyle = col2;
    ctx.fillText(u2.username, 525, 80);

    drawRing(ctx, 175, 195, 60, ov1, col1);
    drawRing(ctx, 525, 195, 60, ov2, col2);

    const r1  = d1.races   || 0, r2  = d2.races   || 0;
    const w1  = d1.wins    || 0, w2  = d2.wins    || 0;
    const p1  = d1.podiums || 0, p2  = d2.podiums || 0;
    const po1 = d1.poles   || 0, po2 = d2.poles   || 0;
    const dn1 = d1.dnf     || 0, dn2 = d2.dnf     || 0;
    const wdc1= d1.wdc     || 0, wdc2= d2.wdc     || 0;

    drawStatRow(ctx, 310, 'Races',   r1,   r2,   cmp(r1,r2));
    drawStatRow(ctx, 340, 'Wins',    w1,   w2,   cmp(w1,w2));
    drawStatRow(ctx, 370, 'Podiums', p1,   p2,   cmp(p1,p2));
    drawStatRow(ctx, 400, 'Poles',   po1,  po2,  cmp(po1,po2));
    drawStatRow(ctx, 430, 'DNF',     dn1,  dn2,  cmp(dn2,dn1));
    drawStatRow(ctx, 460, 'WDC',     wdc1, wdc2, cmp(wdc1,wdc2));

    // Footer
    ctx.fillStyle = '#444444';
    ctx.font = '12px DejaVu Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Olzhasstik Motorsports', 350, 535);

    return canvas.toBuffer('image/png');
}

//--------------------------------
// COMMAND
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Compare two drivers')
        .addUserOption(option =>
            option.setName('pilot1').setDescription('First driver').setRequired(true)
        )
        .addUserOption(option =>
            option.setName('pilot2').setDescription('Second driver').setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const u1 = interaction.options.getUser('pilot1');
        const u2 = interaction.options.getUser('pilot2');

        if (u1.id === u2.id)
            return interaction.editReply('❌ Aynı kullanıcıyı karşılaştıramazsın');

        const d1 = await Driver.findOne({ userId: u1.id });
        const d2 = await Driver.findOne({ userId: u2.id });

        if (!d1 || !d2)
            return interaction.editReply('❌ Sürücülerden biri veritabanında bulunamadı');

        const ov1 = calcOverall(d1);
        const ov2 = calcOverall(d2);

        const png = buildImage(u1, d1, ov1, u2, d2, ov2);

        return interaction.editReply({
            files: [new AttachmentBuilder(png, { name: 'vs.png' })]
        });
    }
};