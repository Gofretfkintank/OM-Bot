const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const Driver = require('../models/Driver');

// --------------------
// GET / CREATE DRIVER
// --------------------
async function getDriver(userId) {
    let driver = await Driver.findOne({ userId });

    if (!driver) {
        driver = await Driver.create({ userId });
    }

    return driver;
}

// --------------------
// PARSE IDS
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

        .addStringOption(opt => opt.setName('dnf').setDescription('DNF drivers (@user or ID)'))
        .addStringOption(opt => opt.setName('dns').setDescription('DNS drivers (@user or ID)'))
        .addStringOption(opt => opt.setName('comments').setDescription('Race comments')),

    async execute(interaction) {
        if (!interaction.channel) return;

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

        const participantIds = participants.map(p => String(p.id));

        // --------------------
        // RESET VOTERS (🔥 DB)
        // --------------------
        if (isGP) {
            await Driver.updateMany({}, { $set: { voters: [] } });
        }

        // --------------------
        // STATS UPDATE
        // --------------------
        for (const [index, user] of participants.entries()) {
            const driver = await getDriver(user.id);

            if (isGP) driver.races++;

            if (index === 0) {
                if (isGP) driver.wins++;
                if (isSprint) driver.poles++;
            }

            if (isGP && index <= 2) {
                driver.podiums++;
            }

            await driver.save();
        }

        // --------------------
        // DNF / DNS
        // --------------------
        const dnfList = parseIds(interaction.options.getString('dnf'));
        const dnsList = parseIds(interaction.options.getString('dns'));

        for (const id of dnfList) {
            const driver = await getDriver(id);

            driver.dnf++;

            if (!participantIds.includes(id) && isGP) {
                driver.races++;
            }

            await driver.save();
        }

        for (const id of dnsList) {
            const driver = await getDriver(id);
            driver.dns++;
            await driver.save();
        }

        // --------------------
        // FORMAT
        // --------------------
        const format = async (id) => {
            try {
                return `<@${id}>`;
            } catch {
                return `Unknown(${id})`;
            }
        };

        // --------------------
        // MESSAGE
        // --------------------
        let msg = `# ${track.toUpperCase()} - ${isGP ? 'GRAND PRIX' : 'SPRINT'}\n\n`;

        participants.forEach((user, i) => {
            msg += `P${i + 1}: ${user}${i === 0 && isSprint ? ' ⏱️ (POLE)' : ''}\n`;
        });

        let lastPos = participants.length;

        for (const id of dnfList) {
            lastPos++;
            msg += `P${lastPos}: ${await format(id)} (DNF)\n`;
        }

        for (const id of dnsList) {
            lastPos++;
            msg += `P${lastPos}: ${await format(id)} (DNS)\n`;
        }

        if (comments) {
            msg += `\n**Comments:**\n${comments}\n`;
        }

        msg += `\n<@&1452705943967105046>`;

        await interaction.reply({ content: msg });

        // --------------------
        // DOTY VOTING
        // --------------------
        if (isGP) {
            const row = new ActionRowBuilder();

            participants.forEach(user => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`doty_${user.id}`)
                        .setLabel(user.username)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            await interaction.followUp({
                content: '⭐ Vote for Driver of the Day!',
                components: [row]
            });
        }
    }
};