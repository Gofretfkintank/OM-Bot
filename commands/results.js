const { 
    SlashCommandBuilder, 
    PermissionFlagsBits 
} = require('discord.js');

const Driver  = require('../models/Driver');
const Economy = require('../models/Economy');
const Sponsor = require('../models/Sponsor');
const { getSponsorById } = require('../data/sponsorCatalog');

// --------------------------
// COIN REWARDS BY POSITION
// --------------------------
// GP: P1=500, P2=350, P3=250, P4=175, P5=150, P6=125, P7-P10=75
// Sprint: exactly half of GP rewards
// DNF: 25 coins (participation)
// DNS: 0 coins

const GP_REWARDS = [500, 350, 250, 175, 150, 125, 75, 75, 75, 75];
const SPRINT_REWARDS = GP_REWARDS.map(v => Math.floor(v / 2));
const DNF_REWARD = 25;

// --------------------------
// GET / CREATE DRIVER
// --------------------------
async function getDriver(userId) {
    let driver = await Driver.findOne({ userId });
    if (!driver) driver = await Driver.create({ userId });
    return driver;
}

// --------------------------
// GET / CREATE WALLET
// --------------------------
async function getWallet(userId) {
    let wallet = await Economy.findOne({ userId });
    if (!wallet) wallet = new Economy({ userId });
    return wallet;
}

// --------------------------
// PARSE IDS (FIXED)
// --------------------------
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

// --------------------------
// COMMAND
// --------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Post race results, update statistics, and distribute coins')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addStringOption(opt => 
            opt.setName('track')
                .setDescription('Track name')
                .setRequired(true)
        )

        .addStringOption(opt =>
            opt.setName('race_type')
                .setDescription('Race type')
                .setRequired(true)
                .addChoices(
                    { name: 'Grand Prix', value: 'gp' },
                    { name: 'Sprint', value: 'sprint' }
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

        .addStringOption(opt => opt.setName('dnf').setDescription('DNF drivers (@user, ID, or username)'))
        .addStringOption(opt => opt.setName('dns').setDescription('DNS drivers (@user, ID, or username)'))
        .addStringOption(opt => opt.setName('comments').setDescription('Race comments')),

    async execute(interaction) {
        if (!interaction.channel) return;

        const track = interaction.options.getString('track');
        const raceType = interaction.options.getString('race_type');
        const comments = interaction.options.getString('comments');

        const isGP = raceType === 'gp';
        const isSprint = raceType === 'sprint';
        const rewards = isGP ? GP_REWARDS : SPRINT_REWARDS;

        // --------------------------
        // PARTICIPANTS
        // --------------------------
        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user) participants.push(user);
        }

        const participantIds = participants.map(p => String(p.id));

        // --------------------------
        // STATS + COINS UPDATE
        // --------------------------
        const coinLog = []; // For the embed summary

        for (const [index, user] of participants.entries()) {
            const driver = await getDriver(user.id);
            const wallet = await getWallet(user.id);

            // Stats
            if (isGP) driver.races++;
            if (index === 0) {
                if (isGP) driver.wins++;
                if (isSprint) driver.poles++;
            }
            if (isGP && index <= 2) driver.podiums++;

            // Race History (son 5 yarış trendi için, sponsor skoru hesaplamada kullanılır)
            if (!driver.raceHistory) driver.raceHistory = [];
            driver.raceHistory.push({ pos: index + 1, type: raceType, date: new Date() });
            if (driver.raceHistory.length > 10) driver.raceHistory.shift(); // maksimum 10 kayıt tut

            await driver.save();

            // Coins (Race Boost kontrolü)
            let earned = rewards[index] ?? 0;
            let boosted = false;
            if (earned > 0 && wallet.raceBoost) {
                earned = Math.floor(earned * 1.5);
                wallet.raceBoost = false; // tek kullanım
                boosted = true;
            }
            if (earned > 0) {
                await wallet.addCoins(earned);
                coinLog.push({ user, pos: index + 1, coins: earned, boosted });
            }

            // Sponsor geliri
            const sponsorRec = await Sponsor.findOne({ userId: user.id });
            if (sponsorRec?.activeSponsorId) {
                const sponsor = getSponsorById(sponsorRec.activeSponsorId);
                if (sponsor) {
                    let sponsorEarned = 0;

                    if (isGP) {
                        sponsorEarned += sponsor.basePerRace;
                        if (index === 0) sponsorEarned += sponsor.winBonus;      // Galibiyet
                        else if (index <= 2) sponsorEarned += sponsor.podiumBonus; // Podyum
                    }
                    if (isSprint && index === 0) sponsorEarned += sponsor.sprintBonus; // Pole

                    if (sponsorEarned > 0) {
                        await wallet.addCoins(sponsorEarned);
                        sponsorRec.racesWithSponsor = (sponsorRec.racesWithSponsor || 0) + (isGP ? 1 : 0);
                        sponsorRec.totalSponsorEarned = (sponsorRec.totalSponsorEarned || 0) + sponsorEarned;
                        await sponsorRec.save();
                        coinLog.push({ user, pos: index + 1, coins: sponsorEarned, isSponsor: true, sponsorName: sponsor.name, sponsorLogo: sponsor.logo });
                    }
                }
            }
        }

        // --------------------------
        // DNF / DNS
        // --------------------------
        const dnfList = parseIds(interaction.options.getString('dnf'), interaction);
        const dnsList = parseIds(interaction.options.getString('dns'), interaction);

        for (const id of dnfList) {
            const driver = await getDriver(id);
            driver.dnf++;
            if (!participantIds.includes(id) && isGP) driver.races++;

            // Race History
            if (!driver.raceHistory) driver.raceHistory = [];
            driver.raceHistory.push({ pos: 99, type: raceType, date: new Date() }); // 99 = DNF
            if (driver.raceHistory.length > 10) driver.raceHistory.shift();

            await driver.save();

            // DNF still gets participation coins
            const wallet = await getWallet(id);
            await wallet.addCoins(DNF_REWARD);
            coinLog.push({ userId: id, pos: 'DNF', coins: DNF_REWARD });

            // Sponsor: yarış sayacı artar ama gelir yok
            if (isGP) {
                const sponsorRec = await Sponsor.findOne({ userId: id });
                if (sponsorRec?.activeSponsorId) {
                    sponsorRec.racesWithSponsor = (sponsorRec.racesWithSponsor || 0) + 1;
                    await sponsorRec.save();
                }
            }
        }

        for (const id of dnsList) {
            const driver = await getDriver(id);
            driver.dns++;
            await driver.save();
            // DNS = 0 coins
        }

        // --------------------------
        // FORMAT RESULTS MESSAGE
        // --------------------------
        let msg = `# ${track.toUpperCase()} - ${isGP ? 'GRAND PRIX' : 'SPRINT'}\n\n`;

        participants.forEach((user, i) => {
            const log = coinLog.find(c => c.user?.id === user.id);
            const rewardStr = log ? ` *(+${log.coins} 🪙${log.boosted ? ' 🚀' : ''})*` : '';
            msg += `P${i + 1}: ${user}${i === 0 && isSprint ? ' ⏱️ (POLE)' : ''}${rewardStr}\n`;
        });

        let lastPos = participants.length;

        for (const id of dnfList) {
            lastPos++;
            msg += `P${lastPos}: <@${id}> (DNF) *(+${DNF_REWARD} 🪙)*\n`;
        }

        for (const id of dnsList) {
            lastPos++;
            msg += `P${lastPos}: <@${id}> (DNS)\n`;
        }

        if (comments) {
            msg += `\n**Comments:**\n${comments}\n`;
        }

        msg += `\n<@&1452705943967105046>`;

        await interaction.reply({ content: msg });
    }
};
