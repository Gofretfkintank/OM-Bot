const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');

const Driver      = require('../models/Driver');
const DriverRating = require('../models/DriverRating');
const Economy     = require('../models/Economy');
const Sponsor     = require('../models/Sponsor');
const { getSponsorById } = require('../data/sponsorCatalog');
const { CHAOS_POOL }     = require('./chaoscall');

// ─────────────────────────────────────────────────────────────────────────────
//  COIN REWARDS BY POSITION
// ─────────────────────────────────────────────────────────────────────────────
const GP_REWARDS     = [500, 350, 250, 175, 150, 125, 75, 75, 75, 75];
const SPRINT_REWARDS = GP_REWARDS.map(v => Math.floor(v / 2));
const DNF_REWARD     = 25;

// ─────────────────────────────────────────────────────────────────────────────
//  CHAOS MODIFIER — applies to the base reward table
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns the modified reward array for a given chaos modifier.
 * @param {number[]} baseRewards  - The original reward table (by finishing index)
 * @param {number}   count        - Number of finishers in this race
 * @param {object}   modifier     - chaos.modifier from CHAOS_POOL
 * @returns {number[]}            - Modified reward table (same length as count)
 */
function applyChaosModifier(baseRewards, count, modifier) {
    // Build a slice for only the actual finishers
    const slice = Array.from({ length: count }, (_, i) => baseRewards[i] ?? 0);

    switch (modifier.type) {
        case 'multiply':
            return slice.map(v => Math.floor(v * modifier.value));

        case 'reverse':
            // Reverse so the last finisher gets P1's coins, P1 gets the last slot's coins
            return [...slice].reverse();

        case 'flat':
            return slice.map(() => modifier.value);

        case 'zero_winner':
            return slice.map((v, i) => (i === 0 ? 0 : v));

        case 'podium_only':
            // Only top 3 earn coins, tripled
            return slice.map((v, i) => (i < 3 ? v * 3 : 0));

        case 'zero_all':
            return slice.map(() => 0);

        default:
            return slice;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function getDriver(userId, guild) {
    let driver = await Driver.findOne({ userId });
    if (!driver) {
        let username = '';
        try {
            const member = guild?.members?.cache?.get(userId)
                || await guild?.members?.fetch(userId).catch(() => null);
            username = member?.user?.username || '';
        } catch { username = ''; }

        driver = await Driver.create({ userId, username });

        const existing = await DriverRating.findOne({ userId });
        if (!existing) await DriverRating.create({ userId, username });
    }
    return driver;
}

async function getWallet(userId) {
    let wallet = await Economy.findOne({ userId });
    if (!wallet) wallet = new Economy({ userId });
    return wallet;
}

function parseIds(input, interaction) {
    if (!input) return [];
    const words = input.split(/[\s,]+/);
    const ids = [];
    for (const word of words) {
        const cleaned = word.replace(/[<@!>]/g, '').trim();
        if (/^\d+$/.test(cleaned)) {
            ids.push(cleaned);
            continue;
        }
        const member = interaction.guild.members.cache.find(m =>
            m.user.username.toLowerCase() === cleaned.toLowerCase() ||
            m.displayName.toLowerCase() === cleaned.toLowerCase()
        );
        if (member) ids.push(member.id);
    }
    return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMMAND
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Post race results, update statistics, and distribute coins')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('track').setDescription('Track name').setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('race_type')
                .setDescription('Race type')
                .setRequired(true)
                .addChoices(
                    { name: 'Grand Prix', value: 'gp' },
                    { name: 'Sprint',     value: 'sprint' }
                )
        )
        .addUserOption(opt => opt.setName('p1').setDescription('1st Place').setRequired(true))
        .addUserOption(opt => opt.setName('p2').setDescription('2nd Place'))
        .addUserOption(opt => opt.setName('p3').setDescription('3rd Place'))
        .addUserOption(opt => opt.setName('p4').setDescription('4th Place'))
        .addUserOption(opt => opt.setName('p5').setDescription('5th Place'))
        .addUserOption(opt => opt.setName('p6').setDescription('6th Place'))
        .addUserOption(opt => opt.setName('p7').setDescription('7th Place'))
        .addUserOption(opt => opt.setName('p8').setDescription('8th Place'))
        .addUserOption(opt => opt.setName('p9').setDescription('9th Place'))
        .addUserOption(opt => opt.setName('p10').setDescription('10th Place'))
        .addStringOption(opt =>
            opt.setName('dnf').setDescription('DNF drivers (@user, ID, or username)')
        )
        .addStringOption(opt =>
            opt.setName('dns').setDescription('DNS drivers (@user, ID, or username)')
        )
        .addStringOption(opt =>
            opt.setName('comments').setDescription('Race comments')
        )
        .addBooleanOption(opt =>
            opt.setName('midseason')
                .setDescription('Mid-Season race? (true = stats not recorded, coins still awarded)')
                .setRequired(false)
        )
        .addIntegerOption(opt =>
            opt.setName('chaoscall')
                .setDescription('Active Chaos Call ID (1-100) — bot adjusts coin rewards automatically if supported')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.channel) return;

        await interaction.deferReply();

        const track      = interaction.options.getString('track');
        const raceType   = interaction.options.getString('race_type');
        const comments   = interaction.options.getString('comments');
        const isMidSeason = interaction.options.getBoolean('midseason') ?? false;
        const chaosId    = interaction.options.getInteger('chaoscall') ?? null;

        const isGP     = raceType === 'gp';
        const isSprint = raceType === 'sprint';

        // ── Resolve active chaos ───────────────────────────────────────────────
        const chaos = chaosId ? CHAOS_POOL.find(c => c.id === chaosId) : null;

        // Base reward table
        let rewards = isGP ? [...GP_REWARDS] : [...SPRINT_REWARDS];

        // Collect participants first so we know count for modifier
        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user) participants.push(user);
        }

        // Apply chaos modifier if it's auto-calculable
        if (chaos?.affectsResults === 'auto' && chaos.modifier) {
            rewards = applyChaosModifier(rewards, participants.length, chaos.modifier);
        }

        const participantIds = participants.map(p => String(p.id));
        const coinLog = [];

        // ── Database loop ──────────────────────────────────────────────────────
        for (const [index, user] of participants.entries()) {
            const driver = await getDriver(user.id, interaction.guild);
            const wallet = await getWallet(user.id);

            // Stats — skipped entirely in mid-season
            if (!isMidSeason) {
                if (isGP) driver.races++;
                if (index === 0) {
                    if (isGP)     driver.wins++;
                    if (isSprint) driver.poles++;
                }
                if (isGP && index <= 2) driver.podiums++;

                if (!driver.raceHistory) driver.raceHistory = [];
                driver.raceHistory.push({ pos: index + 1, type: raceType, date: new Date() });
                if (driver.raceHistory.length > 10) driver.raceHistory.shift();

                await driver.save();
            }

            // Coins — always awarded (chaos modifier already applied to rewards[])
            let earned  = rewards[index] ?? 0;
            let boosted = false;
            if (earned > 0 && wallet.raceBoost) {
                earned = Math.floor(earned * 1.5);
                wallet.raceBoost = false;
                boosted = true;
            }
            if (earned > 0) {
                await wallet.addCoins(earned);
                coinLog.push({ user, pos: index + 1, coins: earned, boosted });
            }

            // Sponsor — skipped for zero_all chaos (no coins in that race)
            if (chaos?.modifier?.type !== 'zero_all') {
                const sponsorRec = await Sponsor.findOne({ userId: user.id });
                if (sponsorRec?.activeSponsorId) {
                    const sponsor = getSponsorById(sponsorRec.activeSponsorId);
                    if (sponsor) {
                        let sponsorEarned = 0;
                        if (isGP) {
                            sponsorEarned += sponsor.basePerRace;
                            if (index === 0)      sponsorEarned += sponsor.winBonus;
                            else if (index <= 2)  sponsorEarned += sponsor.podiumBonus;
                        }
                        if (isSprint && index === 0) sponsorEarned += sponsor.sprintBonus;

                        if (sponsorEarned > 0) {
                            await wallet.addCoins(sponsorEarned);
                            sponsorRec.racesWithSponsor  = (sponsorRec.racesWithSponsor  || 0) + (isGP ? 1 : 0);
                            sponsorRec.totalSponsorEarned = (sponsorRec.totalSponsorEarned || 0) + sponsorEarned;
                            await sponsorRec.save();
                            coinLog.push({ user, pos: index + 1, coins: sponsorEarned, isSponsor: true, sponsorName: sponsor.name });
                        }
                    }
                }
            }
        }

        // ── DNF / DNS ──────────────────────────────────────────────────────────
        const dnfList = parseIds(interaction.options.getString('dnf'), interaction);
        const dnsList = parseIds(interaction.options.getString('dns'), interaction);

        const dnfReward = chaos?.modifier?.type === 'zero_all' ? 0 : DNF_REWARD;

        for (const id of dnfList) {
            const driver = await getDriver(id, interaction.guild);
            if (!isMidSeason) {
                driver.dnf++;
                if (!participantIds.includes(id) && isGP) driver.races++;

                if (!driver.raceHistory) driver.raceHistory = [];
                driver.raceHistory.push({ pos: 99, type: raceType, date: new Date() });
                if (driver.raceHistory.length > 10) driver.raceHistory.shift();

                await driver.save();
            }

            if (dnfReward > 0) {
                const wallet = await getWallet(id);
                await wallet.addCoins(dnfReward);
                coinLog.push({ userId: id, pos: 'DNF', coins: dnfReward });
            }

            if (!isMidSeason && isGP) {
                const sponsorRec = await Sponsor.findOne({ userId: id });
                if (sponsorRec?.activeSponsorId) {
                    sponsorRec.racesWithSponsor = (sponsorRec.racesWithSponsor || 0) + 1;
                    await sponsorRec.save();
                }
            }
        }

        for (const id of dnsList) {
            if (!isMidSeason) {
                const driver = await getDriver(id, interaction.guild);
                driver.dns++;
                await driver.save();
            }
        }

        // ── Build result message ───────────────────────────────────────────────
        const seasonTag  = isMidSeason ? ' *(Mid-Season — stats not recorded)*' : '';
        const raceLabel  = isGP ? 'GRAND PRIX' : 'SPRINT';
        let msg = `# ${track.toUpperCase()} — ${raceLabel}${seasonTag}\n\n`;

        // Chaos header
        if (chaos) {
            if (chaos.affectsResults === 'auto') {
                msg += `⚡ **Chaos Call #${chaos.id} — ${chaos.title}** *(applied automatically)*\n\n`;
            } else if (chaos.affectsResults === 'manual') {
                msg += `⚠️ **Chaos Call #${chaos.id} — ${chaos.title}** *(manual adjustment required)*\n`;
                msg += `> ${chaos.manualNote}\n\n`;
            }
        }

        participants.forEach((user, i) => {
            const log = coinLog.find(c => c.user?.id === user.id && !c.isSponsor);
            const rewardStr = log
                ? ` *(+${log.coins} 🪙${log.boosted ? ' 🚀' : ''})*`
                : chaos?.modifier?.type === 'zero_all' ? ' *(Glory only 🏆)*' : '';
            msg += `P${i + 1}: ${user}${i === 0 && isSprint ? ' ⏱️ (POLE)' : ''}${rewardStr}\n`;
        });

        let lastPos = participants.length;
        for (const id of dnfList) {
            lastPos++;
            const dnfStr = dnfReward > 0 ? ` *(+${dnfReward} 🪙)*` : '';
            msg += `P${lastPos}: <@${id}> (DNF)${dnfStr}\n`;
        }
        for (const id of dnsList) {
            lastPos++;
            msg += `P${lastPos}: <@${id}> (DNS)\n`;
        }

        if (comments) msg += `\n**Comments:**\n${comments}\n`;
        msg += `\n<@&1452705943967105046>`;

        await interaction.editReply({ content: msg });
    },
};
