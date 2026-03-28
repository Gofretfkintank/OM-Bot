const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const fs = require('fs');

const driversPath = './drivers.json';

// --------------------
// LOAD / SAVE
// --------------------
const loadDrivers = () => {
    try {
        let data = JSON.parse(fs.readFileSync(driversPath, 'utf8'));

        return data.map(d => ({
            userId: String(d.userId).trim(),
            races: Number(d.races) || 0,
            wins: Number(d.wins) || 0,
            podiums: Number(d.podiums) || 0,
            poles: Number(d.poles) || 0,
            dnf: Number(d.dnf) || 0,
            dns: Number(d.dns) || 0,
            wdc: Number(d.wdc) || 0,
            wcc: Number(d.wcc) || 0,
            doty: Number(d.doty) || 0,
            voters: Array.isArray(d.voters) ? d.voters : []
        }));
    } catch {
        return [];
    }
};

const saveDrivers = (data) => {
    fs.writeFileSync(driversPath, JSON.stringify(data, null, 2));
};

// --------------------
// GET OR CREATE DRIVER
// --------------------
function getDriver(drivers, userId) {
    userId = String(userId).trim();

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
// COMMAND
// --------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('dotyvote')
        .setDescription('Starts a 1-hour Driver of the Day vote.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // REQUIRED
        .addUserOption(opt => 
            opt.setName('p1')
                .setDescription('Driver 1')
                .setRequired(true)
        )

        // OPTIONAL USERS
        .addUserOption(opt => opt.setName('p2').setDescription('Driver 2'))
        .addUserOption(opt => opt.setName('p3').setDescription('Driver 3'))
        .addUserOption(opt => opt.setName('p4').setDescription('Driver 4'))
        .addUserOption(opt => opt.setName('p5').setDescription('Driver 5'))
        .addUserOption(opt => opt.setName('p6').setDescription('Driver 6'))
        .addUserOption(opt => opt.setName('p7').setDescription('Driver 7'))
        .addUserOption(opt => opt.setName('p8').setDescription('Driver 8'))
        .addUserOption(opt => opt.setName('p9').setDescription('Driver 9'))
        .addUserOption(opt => opt.setName('p10').setDescription('Driver 10'))
        .addUserOption(opt => opt.setName('p11').setDescription('Driver 11'))
        .addUserOption(opt => opt.setName('p12').setDescription('Driver 12'))
        .addUserOption(opt => opt.setName('p13').setDescription('Driver 13'))
        .addUserOption(opt => opt.setName('p14').setDescription('Driver 14'))
        .addUserOption(opt => opt.setName('p15').setDescription('Driver 15'))

        // ROLE
        .addRoleOption(opt =>
            opt.setName('ping_role')
                .setDescription('Role to ping when vote ends')
        ),

    async execute(interaction) {
        const participants = [];
        const seenIds = new Set();
        const voteCountMap = new Map();
        const pingRole = interaction.options.getRole('ping_role');

        // --------------------
        // PARTICIPANTS
        // --------------------
        for (let i = 1; i <= 15; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user && !seenIds.has(user.id)) {
                participants.push(user);
                seenIds.add(user.id);
                voteCountMap.set(user.id, 0);
            }
        }

        if (participants.length === 0) {
            return interaction.reply({ content: 'No participants!', ephemeral: true });
        }

        // --------------------
        // BUTTONS
        // --------------------
        const rows = [];
        let currentRow = new ActionRowBuilder();

        participants.forEach((user, index) => {
            const displayName = user.globalName || user.username;

            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`doty_${user.id}`)
                    .setLabel(displayName.slice(0, 20))
                    .setStyle(ButtonStyle.Primary)
            );

            if ((index + 1) % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        });

        if (currentRow.components.length > 0) rows.push(currentRow);

        // --------------------
        // START MESSAGE
        // --------------------
        const endTime = Math.floor((Date.now() + 3600000) / 1000);
        const mentionList = participants.map(p => `<@${p.id}>`).join(', ');

        const voteMsg = await interaction.reply({
            content: `⭐ **DOTY Voting OPEN!**\n⏳ Ends: <t:${endTime}:R>\n\n👥 ${mentionList}`,
            components: rows,
            fetchReply: true
        });

        // --------------------
        // COLLECTOR
        // --------------------
        const collector = voteMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 3600000,
            filter: i => i.customId.startsWith('doty_')
        });

        const userVoters = new Set();

        collector.on('collect', async i => {
            const votedId = i.customId.split('_')[1];

            if (userVoters.has(i.user.id)) {
                return i.reply({ content: '⚠️ You already voted!', ephemeral: true });
            }

            userVoters.add(i.user.id);

            voteCountMap.set(
                votedId,
                (voteCountMap.get(votedId) || 0) + 1
            );

            await i.reply({
                content: `✅ Vote recorded for <@${votedId}>!`,
                ephemeral: true
            });
        });

        // --------------------
        // END
        // --------------------
        collector.on('end', async () => {
            const totalVotes = Array.from(voteCountMap.values()).reduce((a, b) => a + b, 0);

            let maxVotes = 0;
            let winners = [];

            for (const [id, count] of voteCountMap) {
                if (count > maxVotes) {
                    maxVotes = count;
                    winners = [id];
                } else if (count === maxVotes && count > 0) {
                    winners.push(id);
                }
            }

            if (maxVotes === 0) winners = [];

            let drivers = loadDrivers();

            if (winners.length > 0) {
                winners.forEach(id => {
                    let driver = getDriver(drivers, id);
                    driver.doty += 1;
                });
                saveDrivers(drivers);
            }

            // ✅ SAFE DISABLE
            const disabledRows = rows.map(row => {
                const newRow = new ActionRowBuilder();
                row.components.forEach(btn => {
                    newRow.addComponents(
                        ButtonBuilder.from(btn).setDisabled(true)
                    );
                });
                return newRow;
            });

            // RESULT TEXT
            let resultText = '';

            if (winners.length === 0) {
                resultText = '❌ No votes recorded.';
            } else {
                const percentage = totalVotes > 0
                    ? ((maxVotes / totalVotes) * 100).toFixed(1)
                    : 0;

                if (winners.length === 1) {
                    resultText = `🏆 **Winner:** <@${winners[0]}> with **${maxVotes}** votes (%${percentage})!`;
                } else {
                    const mentions = winners.map(id => `<@${id}>`).join(', ');
                    resultText = `⚖️ **Tie:** ${mentions} (**${maxVotes}** votes each - %${percentage})`;
                }
            }

            const rolePing = pingRole ? `\n${pingRole}` : '';

            await voteMsg.edit({
                content: `⭐ **Voting Closed!**\n\n${resultText}${rolePing}`,
                components: disabledRows
            });
        });
    }
};