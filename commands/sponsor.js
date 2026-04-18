// commands/sponsor.js
// OM Sponsor System
// ─────────────────────────────────────────────────────────────────────────────
// /sponsor offers    → View available offers (personalized, ephemeral)
// /sponsor sign      → Accept a sponsor from the offers
// /sponsor status    → View active sponsor and earnings
// /sponsor drop      → Drop current sponsor (24-hour cooldown)
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const Driver  = require('../models/Driver');
const Economy = require('../models/Economy');
const Sponsor = require('../models/Sponsor');

const {
    generateOffers,
    getSponsorById,
    calcDriverScore,
    TIER_COLORS,
    TIER_LABELS
} = require('../data/sponsorCatalog');

// Refresh rate for offers
const OFFER_REFRESH_HOURS = 60; // 2.5 days
const OFFER_REFRESH_MS    = OFFER_REFRESH_HOURS * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getWallet(userId) {
    let w = await Economy.findOne({ userId });
    if (!w) w = new Economy({ userId });
    return w;
}

async function getDriver(userId) {
    let d = await Driver.findOne({ userId });
    if (!d) d = await Driver.create({ userId });
    return d;
}

async function getSponsorRecord(userId) {
    let s = await Sponsor.findOne({ userId });
    if (!s) s = new Sponsor({ userId });
    return s;
}

// Refresh offers if expired or empty
async function refreshOffersIfNeeded(sponsorRecord, driver) {
    const now = Date.now();
    const generated = sponsorRecord.offersGeneratedAt?.getTime() ?? 0;
    const expired = (now - generated) > OFFER_REFRESH_MS;

    if (expired || sponsorRecord.offers.length === 0) {
        const newOffers = generateOffers(driver);
        sponsorRecord.offers = newOffers.map(s => s.id);
        sponsorRecord.offersGeneratedAt = new Date();
        await sponsorRecord.save();
        return true; // refreshed
    }
    return false; // not refreshed
}

// Time remaining string helper
function timeLeft(fromDate, durationMs) {
    const diff = (fromDate.getTime() + durationMs) - Date.now();
    if (diff <= 0) return 'now';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) {
        const d = Math.floor(h / 24);
        const rh = h % 24;
        return `${d}d ${rh}h`;
    }
    return `${h}h ${m}m`;
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sponsor')
        .setDescription('Sponsor system — receive offers and sign deals.')

        .addSubcommand(sub =>
            sub.setName('offers')
                .setDescription('View your personalized sponsor offers.')
        )
        .addSubcommand(sub =>
            sub.setName('sign')
                .setDescription('Accept a sponsor offer.')
                .addStringOption(opt =>
                    opt.setName('sponsor_id')
                        .setDescription('The Sponsor ID (find it via /sponsor offers)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('View active sponsor and earnings.')
                .addUserOption(opt =>
                    opt.setName('driver')
                        .setDescription('Check another driver\'s sponsor (optional)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('drop')
                .setDescription('Terminate your current sponsor agreement.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ── /sponsor offers ────────────────────────────────────────────────
        if (sub === 'offers') {
            await interaction.deferReply({ ephemeral: true });

            const driver       = await getDriver(interaction.user.id);
            const sponsorRec   = await getSponsorRecord(interaction.user.id);
            const wasRefreshed = await refreshOffersIfNeeded(sponsorRec, driver);

            if (sponsorRec.offers.length === 0) {
                return interaction.editReply({
                    content: '❌ No offers available yet. Participate in more races!'
                });
            }

            const score = calcDriverScore(driver);

            // Offer embeds
            const embeds = sponsorRec.offers.map((sId, i) => {
                const s = getSponsorById(sId);
                if (!s) return null;

                return new EmbedBuilder()
                    .setColor(s.color)
                    .setTitle(`${s.logo} ${s.name}`)
                    .setDescription(`*${s.description}*`)
                    .addFields(
                        { name: '🏷️ Tier', value: TIER_LABELS[s.tier], inline: true },
                        { name: '🪙 Per GP', value: `**+${s.basePerRace}**`, inline: true },
                        { name: '🏆 Win Bonus', value: `**+${s.winBonus}**`, inline: true },
                        { name: '🥈 Podium Bonus', value: `**+${s.podiumBonus}**`, inline: true },
                        { name: '⏱️ Sprint Bonus', value: `**+${s.sprintBonus}**`, inline: true },
                        { name: '📋 To Accept', value: `\`/sponsor sign ${s.id}\``, inline: true }
                    );
            }).filter(Boolean);

            const nextRefresh = timeLeft(sponsorRec.offersGeneratedAt, OFFER_REFRESH_MS);

            const headerEmbed = new EmbedBuilder()
                .setColor(0xf5c518)
                .setTitle('📨 Your Sponsor Offers')
                .setDescription(
                    `Driver Score: **${score.toFixed(1)} / 100**\n` +
                    `${wasRefreshed ? '🔄 Offers have been refreshed!\n' : ''}` +
                    `⏳ Offers refresh in: **${nextRefresh}**.\n\n` +
                    `${sponsorRec.activeSponsorId
                        ? `⚠️ You already have an active sponsor: **${getSponsorById(sponsorRec.activeSponsorId)?.name ?? sponsorRec.activeSponsorId}**. You must \`/sponsor drop\` first.`
                        : '✅ No active sponsor. You can accept an offer!'
                    }`
                )
                .setFooter({ text: 'These offers are only visible to you.' });

            return interaction.editReply({ embeds: [headerEmbed, ...embeds] });
        }

        // ── /sponsor sign ──────────────────────────────────────────────────
        if (sub === 'sign') {
            const sponsorId  = interaction.options.getString('sponsor_id').trim().toLowerCase();
            const sponsorRec = await getSponsorRecord(interaction.user.id);

            // Active sponsor check
            if (sponsorRec.activeSponsorId) {
                const current = getSponsorById(sponsorRec.activeSponsorId);
                return interaction.reply({
                    content: `❌ You already have a deal with **${current?.name ?? sponsorRec.activeSponsorId}**. Please \`/sponsor drop\` first.`,
                    ephemeral: true
                });
            }

            // Is it in the offers?
            if (!sponsorRec.offers.includes(sponsorId)) {
                return interaction.reply({
                    content: `❌ \`${sponsorId}\` is not among your current offers. Check IDs with \`/sponsor offers\`.`,
                    ephemeral: true
                });
            }

            const sponsor = getSponsorById(sponsorId);
            if (!sponsor) {
                return interaction.reply({
                    content: `❌ Sponsor not found.`,
                    ephemeral: true
                });
            }

            // Save agreement
            sponsorRec.activeSponsorId  = sponsorId;
            sponsorRec.sponsorSince     = new Date();
            sponsorRec.racesWithSponsor = 0;
            sponsorRec.sponsorHistory.push(sponsorId);
            
            // Clear offers upon signing
            sponsorRec.offers = [];
            sponsorRec.offersGeneratedAt = null;
            await sponsorRec.save();

            const embed = new EmbedBuilder()
                .setColor(sponsor.color)
                .setTitle(`🤝 Agreement Signed!`)
                .setDescription(
                    `You have signed a sponsorship deal with **${sponsor.logo} ${sponsor.name}**!\n\n` +
                    `*${sponsor.description}*`
                )
                .addFields(
                    { name: '🪙 Per GP', value: `**+${sponsor.basePerRace} 🪙**`, inline: true },
                    { name: '🏆 Win Bonus', value: `**+${sponsor.winBonus} 🪙**`, inline: true },
                    { name: '🥈 Podium Bonus', value: `**+${sponsor.podiumBonus} 🪙**`, inline: true },
                    { name: '⏱️ Sprint/Pole', value: `**+${sponsor.sprintBonus} 🪙****`, inline: true }
                )
                .setFooter({ text: 'Sponsor earnings are automatically deposited after each race.' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ── /sponsor status ────────────────────────────────────────────────
        if (sub === 'status') {
            const target     = interaction.options.getUser('driver') ?? interaction.user;
            const sponsorRec = await getSponsorRecord(target.id);
            const driver     = await getDriver(target.id);

            const member      = await interaction.guild.members.fetch(target.id).catch(() => null);
            const displayName = member?.displayName ?? target.username;
            const score       = calcDriverScore(driver);

            if (!sponsorRec.activeSponsorId) {
                const nextRefresh = sponsorRec.offersGeneratedAt
                    ? timeLeft(sponsorRec.offersGeneratedAt, OFFER_REFRESH_MS)
                    : 'immediately';

                const embed = new EmbedBuilder()
                    .setColor(0x888888)
                    .setAuthor({ name: `${displayName} — Sponsor Status`, iconURL: target.displayAvatarURL({ dynamic: true }) })
                    .setDescription(
                        `❌ No active sponsor.\n\n` +
                        (target.id === interaction.user.id
                            ? `Use \`/sponsor offers\` to see your deals.\n⏳ New offers ready: **${nextRefresh}**.`
                            : '')
                    )
                    .addFields({ name: '📊 Driver Score', value: `**${score.toFixed(1)} / 100**`, inline: true })
                    .setFooter({ text: 'OM Economy System' });

                return interaction.reply({ embeds: [embed], ephemeral: target.id === interaction.user.id });
            }

            const sponsor = getSponsorById(sponsorRec.activeSponsorId);
            const since   = sponsorRec.sponsorSince
                ? `<t:${Math.floor(sponsorRec.sponsorSince.getTime() / 1000)}:R>`
                : 'unknown';

            const embed = new EmbedBuilder()
                .setColor(sponsor?.color ?? 0xf5c518)
                .setAuthor({ name: `${displayName} — Sponsor Status`, iconURL: target.displayAvatarURL({ dynamic: true }) })
                .setTitle(`${sponsor?.logo ?? '🏷️'} ${sponsor?.name ?? sponsorRec.activeSponsorId}`)
                .setDescription(sponsor?.description ?? '')
                .addFields(
                    { name: '📅 Agreement Started', value: since, inline: true },
                    { name: '🏁 Races Together', value: `**${sponsorRec.racesWithSponsor}**`, inline: true },
                    { name: '💰 Total Earned', value: `**${sponsorRec.totalSponsorEarned.toLocaleString()} 🪙**`, inline: true },
                    { name: '🪙 Per GP', value: `**+${sponsor?.basePerRace ?? '?'}**`, inline: true },
                    { name: '🏆 Win Bonus', value: `**+${sponsor?.winBonus ?? '?'}**`, inline: true },
                    { name: '🥈 Podium Bonus', value: `**+${sponsor?.podiumBonus ?? '?'}**`, inline: true },
                    { name: '📊 Driver Score', value: `**${score.toFixed(1)} / 100**`, inline: true },
                    { name: '🏷️ Tier', value: TIER_LABELS[sponsor?.tier] ?? '?', inline: true }
                )
                .setFooter({ text: 'OM Economy System' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ── /sponsor drop ──────────────────────────────────────────────────
        if (sub === 'drop') {
            const sponsorRec = await getSponsorRecord(interaction.user.id);

            if (!sponsorRec.activeSponsorId) {
                return interaction.reply({
                    content: '❌ You do not have an active sponsor.',
                    ephemeral: true
                });
            }

            const sponsor = getSponsorById(sponsorRec.activeSponsorId);

            // Terminate agreement and reset offers
            sponsorRec.activeSponsorId  = null;
            sponsorRec.sponsorSince     = null;
            sponsorRec.racesWithSponsor = 0;
            
            // Clear current offers to require fresh activity for new ones
            sponsorRec.offers = [];
            sponsorRec.offersGeneratedAt = null;
            await sponsorRec.save();

            return interaction.reply({
                content: `✅ Agreement with **${sponsor?.logo ?? ''} ${sponsor?.name ?? 'Sponsor'}** has been terminated. New offers will arrive in 2-3 days.`,
                ephemeral: false
            });
        }
    }
};
