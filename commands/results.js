const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionFlagsBits 
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');

const driversFile = path.join(__dirname, '../drivers.json');

// --------------------
// LOAD / SAVE
// --------------------
function loadDrivers() {
    try {
        return JSON.parse(fs.readFileSync(driversFile, 'utf8'));
    } catch {
        return [];
    }
}

function saveDrivers(data) {
    fs.writeFileSync(driversFile, JSON.stringify(data, null, 2));
}

// --------------------
// AUTO CREATE DRIVER 🔥
// --------------------
function getDriver(drivers, userId) {
    let driver = drivers.find(d => d.userId === userId);

    if (!driver) {
        driver = {
            userId,
            races: 0,
            wins: 0,
            podiums: 0,
            poles: 0,
            dnf: 0,
            dns: 0,
            wdc: 0,
            wcc: 0,
            doty: 0,
            voters: []
        };

        drivers.push(driver);
    }

    return driver;
}

// --------------------
// PARSE IDS (MULTI FIX)
// --------------------
function parseIds(input) {
    if (!input) return [];

    return input
        .split(/[\s,]+/)
        .map(id => id.replace(/[<@!>]/g, '').trim())
        .filter(id => id.length > 0);
}

// --------------------
// COMMAND
// --------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Post race results and update statistics')
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

        .addStringOption(opt => opt.setName('dnf').setDescription('DNF drivers'))
        .addStringOption(opt => opt.setName('dns').setDescription('DNS drivers'))
        .addStringOption(opt => opt.setName('comments').setDescription('Race comments')),

    async execute(interaction) {
        if (!interaction.channel) return;

        let drivers = loadDrivers();

        const track = interaction.options.getString('track');
        const raceType = interaction.options.getString('race_type');
        const comments = interaction.options.getString('comments');

        const isGP = raceType === 'gp';
        const isSprint = raceType === 'sprint';

        // --------------------
        // PARTICIPANTS
        // --------------------
        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user) participants.push(user);
        }

        const participantIds = participants.map(p => p.id);

        // --------------------
        // STATS UPDATE
        // --------------------
        participants.forEach((user, index) => {
            const driver = getDriver(drivers, user.id); // 🔥 AUTO CREATE

            if (isGP) driver.races++;

            if (index === 0) {
                if (isGP) driver.wins++;
                if (isSprint) driver.poles++;
            }

            if (isGP && index <= 2) {
                driver.podiums++;
            }
        });

        // --------------------
        // DNF / DNS
        // --------------------
        const dnfList = parseIds(interaction.options.getString('dnf'));
        const dnsList = parseIds(interaction.options.getString('dns'));

        dnfList.forEach(id => {
            const driver = getDriver(drivers, id); // 🔥 AUTO CREATE

            driver.dnf++;

            if (!participantIds.includes(id) && isGP) {
                driver.races++;
            }
        });

        dnsList.forEach(id => {
            const driver = getDriver(drivers, id); // 🔥 AUTO CREATE
            driver.dns++;
        });

        saveDrivers(drivers);

        // --------------------
        // MESSAGE
        // --------------------
        let msg = `# ${track.toUpperCase()} - ${isGP ? 'GRAND PRIX' : 'SPRINT'}\n\n`;

        participants.forEach((user, i) => {
            msg += `P${i + 1}: ${user}${i === 0 && isSprint ? ' ⏱️ (POLE)' : ''}\n`;
        });

        let lastPos = participants.length;

        const format = id => `<@${id}>`;

        dnfList.forEach(id => {
            lastPos++;
            msg += `P${lastPos}: ${format(id)} (DNF)\n`;
        });

        dnsList.forEach(id => {
            lastPos++;
            msg += `P${lastPos}: ${format(id)} (DNS)\n`;
        });

        if (comments) {
            msg += `\n**Comments:**\n${comments}\n`;
        }

        msg += `\n<@&1452705943967105046>`;

        // --------------------
        // DOTY BUTTON
        // --------------------
        const components = [];

        if (isGP) {
            components.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('vote_doty')
                        .setLabel('Vote DOTY')
                        .setStyle(ButtonStyle.Primary)
                )
            );
        }

        const initialReply = await interaction.reply({
            content: msg,
            components,
            fetchReply: true
        });

        // --------------------
        // DOTY TIMER
        // --------------------
        if (isGP) {
            setTimeout(async () => {
                try {
                    let freshDrivers = loadDrivers();
                    const messageId = initialReply.id;

                    let votes = [];

                    freshDrivers.forEach(d => {
                        const count = (d.voters || []).filter(v => v.startsWith(messageId)).length;
                        if (count > 0) votes.push({ userId: d.userId, count });
                    });

                    if (votes.length === 0) {
                        return interaction.channel.send("🏁 No votes cast.");
                    }

                    votes.sort((a, b) => b.count - a.count);

                    const top = votes[0].count;
                    const winners = votes.filter(v => v.count === top);

                    if (winners.length === 1) {
                        const winner = freshDrivers.find(d => d.userId === winners[0].userId);
                        if (winner) winner.doty++;
                    }

                    const text = winners.length === 1
                        ? `<@${winners[0].userId}> wins DOTY with **${top}** votes!`
                        : winners.map(w => `<@${w.userId}>`).join(', ') + ` tied with **${top}** votes!`;

                    const embed = new EmbedBuilder()
                        .setTitle('🌟 DRIVER OF THE DAY')
                        .setDescription(text)
                        .setColor('#FFD700');

                    await interaction.channel.send({ embeds: [embed] });

                    // CLEAN VOTERS
                    freshDrivers.forEach(d => {
                        if (d.voters) {
                            d.voters = d.voters.filter(v => !v.startsWith(messageId));
                        }
                    });

                    saveDrivers(freshDrivers);

                    await initialReply.edit({
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('vote_doty_closed')
                                    .setLabel('Voting Closed')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setDisabled(true)
                            )
                        ]
                    });

                } catch (err) {
                    console.error('DOTY ERROR:', err);
                }
            }, 3600000);
        }
    }
};