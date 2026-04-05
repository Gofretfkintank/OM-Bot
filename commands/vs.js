// commands/vs.js
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const sharp = require('sharp');

// ── Overall Calculation ──────────────────────────────────────────────────────
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

// ── Color Scale ─────────────────────────────────────────────────────────────
function overallColor(pct) {
    if (pct >= 75) return '#00E676';
    if (pct >= 50) return '#FFEB3B';
    if (pct >= 25) return '#FF9800';
    return '#F44336';
}

// ── SVG Circle Path ─────────────────────────────────────────────────────────
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

// ── Stat Row ────────────────────────────────────────────────────────────────
function statRow(y, label, v1, v2, winner) {
    const c1 = winner === 'left'  ? '#00E676' : winner === 'tie' ? '#FFEB3B' : '#aaaaaa';
    const c2 = winner === 'right' ? '#00E676' : winner === 'tie' ? '#FFEB3B' : '#aaaaaa';
    return `
  <text x="175" y="${y}" text-anchor="end"   fill="${c1}" font-size="18" font-family="sans-serif" font-weight="bold">${v1}</text>
  <text x="350" y="${y}" text-anchor="middle" fill="#888888" font-size="14" font-family="sans-serif">${label}</text>
  <text x="525" y="${y}" text-anchor="start"  fill="${c2}" font-size="18" font-family="sans-serif" font-weight="bold">${v2}</text>`;
}

// ── Main SVG Builder ────────────────────────────────────────────────────────
function buildSVG(u1, d1, ov1, u2, d2, ov2) {
    const W = 700, H = 520;
    const col1 = overallColor(ov1);
    const col2 = overallColor(ov2);
    const r = 60;

    const cmp = (a, b) => a > b ? ['left','right'] : a < b ? ['right','left'] : ['tie','tie'];

    const winnerRaces  = cmp(d1.races   ||0, d2.races   ||0);
    const winnerWins   = cmp(d1.wins    ||0, d2.wins    ||0);
    const winnerPod    = cmp(d1.podiums ||0, d2.podiums ||0);
    const winnerPoles  = cmp(d1.poles   ||0, d2.poles   ||0);
    const winnerDNF    = cmp(d2.dnf     ||0, d1.dnf     ||0); // Less is better
    const winnerChamp  = cmp((d1.wdc||0)+(d1.wcc||0), (d2.wdc||0)+(d2.wcc||0));

    const rate1 = d1.races > 0 ? ((d1.wins||0)/d1.races*100).toFixed(1) : '0.0';
    const rate2 = d2.races > 0 ? ((d2.wins||0)/d2.races*100).toFixed(1) : '0.0';
    const winnerRate = cmp(parseFloat(rate1), parseFloat(rate2));

    const ini1 = u1.username.charAt(0).toUpperCase();
    const ini2 = u2.username.charAt(0).toUpperCase();

    const vsLabel = ov1 > ov2 ? `${u1.username} wins` :
                    ov2 > ov1 ? `${u2.username} wins` : 'Draw!';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#12121f"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>
    <linearGradient id="divider" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E10600" stop-opacity="0"/>
      <stop offset="50%" stop-color="#E10600" stop-opacity="1"/>
      <stop offset="100%" stop-color="#E10600" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)" rx="18"/>
  <rect width="${W}" height="${H}" fill="none" stroke="#E10600" stroke-width="2" stroke-opacity="0.4" rx="18"/>
  <rect x="348" y="20" width="4" height="${H-40}" fill="url(#divider)" rx="2"/>

  <text x="350" y="38" text-anchor="middle" fill="#E10600" font-size="20" font-family="sans-serif" font-weight="900" letter-spacing="4">VS</text>

  <circle cx="175" cy="95" r="42" fill="#1e1e35" stroke="${col1}" stroke-width="3"/>
  <text x="175" y="103" text-anchor="middle" fill="${col1}" font-size="36" font-family="sans-serif" font-weight="bold">${ini1}</text>
  <text x="175" y="155" text-anchor="middle" fill="#ffffff" font-size="16" font-family="sans-serif" font-weight="bold">${u1.username}</text>
  ${ringPath(175, 215, r, ov1, col1)}
  <text x="175" y="208" text-anchor="middle" fill="${col1}" font-size="22" font-family="sans-serif" font-weight="900">${ov1}</text>
  <text x="175" y="228" text-anchor="middle" fill="#888888" font-size="11" font-family="sans-serif">OVERALL</text>

  <circle cx="525" cy="95" r="42" fill="#1e1e35" stroke="${col2}" stroke-width="3"/>
  <text x="525" y="103" text-anchor="middle" fill="${col2}" font-size="36" font-family="sans-serif" font-weight="bold">${ini2}</text>
  <text x="525" y="155" text-anchor="middle" fill="#ffffff" font-size="16" font-family="sans-serif" font-weight="bold">${u2.username}</text>
  ${ringPath(525, 215, r, ov2, col2)}
  <text x="525" y="208" text-anchor="middle" fill="${col2}" font-size="22" font-family="sans-serif" font-weight="900">${ov2}</text>
  <text x="525" y="228" text-anchor="middle" fill="#888888" font-size="11" font-family="sans-serif">OVERALL</text>

  <line x1="40" y1="295" x2="660" y2="295" stroke="#2a2a3a" stroke-width="1"/>

  ${statRow(323, 'Races',        d1.races||0,   d2.races||0,   winnerRaces[0])}
  ${statRow(351, 'Wins',         d1.wins||0,    d2.wins||0,    winnerWins[0])}
  ${statRow(379, 'Podiums',      d1.podiums||0, d2.podiums||0, winnerPod[0])}
  ${statRow(407, 'Poles',        d1.poles||0,   d2.poles||0,   winnerPoles[0])}
  ${statRow(435, 'Win %',        rate1+'%',     rate2+'%',     winnerRate[0])}
  ${statRow(463, 'DNF',          d1.dnf||0,     d2.dnf||0,     winnerDNF[0])}
  ${statRow(491, 'Championships', (d1.wdc||0)+(d1.wcc||0), (d2.wdc||0)+(d2.wcc||0), winnerChamp[0])}

  <rect x="0" y="${H-44}" width="${W}" height="44" fill="#0d0d1a" rx="18"/>
  <rect x="0" y="${H-44}" width="${W}" height="22" fill="#0d0d1a"/>
  <text x="${W/2}" y="${H-16}" text-anchor="middle" fill="#E10600" font-size="14" font-family="sans-serif" font-weight="bold">🏁 ${vsLabel}</text>
</svg>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Compare stats of two pilots')
        .addUserOption(opt =>
            opt.setName('pilot1').setDescription('First pilot').setRequired(true))
        .addUserOption(opt =>
            opt.setName('pilot2').setDescription('Second pilot').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const u1 = interaction.options.getUser('pilot1');
        const u2 = interaction.options.getUser('pilot2');

        if (u1.id === u2.id) {
            return interaction.editReply({ content: '❌ You cannot select the same pilot twice.' });
        }

        let d1, d2;
        try {
            [d1, d2] = await Promise.all([
                Driver.findOne({ userId: u1.id }),
                Driver.findOne({ userId: u2.id }),
            ]);
        } catch (err) {
            console.error(err);
            return interaction.editReply({ content: '❌ Database error.' });
        }

        if (!d1) return interaction.editReply({ content: `❌ **${u1.username}** is not registered.` });
        if (!d2) return interaction.editReply({ content: `❌ **${u2.username}** is not registered.` });

        const ov1 = calcOverall(d1);
        const ov2 = calcOverall(d2);

        const svg = buildSVG(u1, d1, ov1, u2, d2, ov2);

        let pngBuffer;
        try {
            pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
        } catch (err) {
            console.error('Sharp error:', err);
            return interaction.editReply({ content: '❌ Image could not be generated.' });
        }

        const attachment = new AttachmentBuilder(pngBuffer, { name: 'vs.png' });
        await interaction.editReply({ files: [attachment] });
    }
};
