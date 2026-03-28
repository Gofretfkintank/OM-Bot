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

// Helper functions for DB management
const loadDrivers = () => JSON.parse(fs.readFileSync(driversPath, 'utf8'));
const saveDrivers = (data) => fs.writeFileSync(driversPath, JSON.stringify(data, null, 2));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dotyvote')
        .setDescription('Starts a 1-hour Driver of the Day vote.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(opt => opt.setName('p1').setDescription('Driver 1').setRequired(true))
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
        .addUserOption(opt => opt.setName('p15').setDescription('Driver 15')),

    async execute(interaction) {
        const participants = [];
        const seenIds = new Set();
        const voteCountMap = new Map(); // Store votes in RAM during the hour

        // 1. Filter out duplicates and initialize vote map
        for (let i = 1; i <= 15; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user && !seenIds.has(user.id)) {
                participants.push(user);
                seenIds.add(user.id);
                voteCountMap.set(user.id, 0);
            }
        }

        // 2. Build the UI components (Buttons)
        const rows = [];
        let currentRow = new ActionRowBuilder();

        participants.forEach((user, index) => {
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`doty_${user.id}`)
                    .setLabel(user.username.slice(0, 20))
                    .setStyle(ButtonStyle.Primary)
            );

            if ((index + 1) % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        });

        if (currentRow.components.length > 0) rows.push(currentRow);

        const voteMsg = await interaction.reply({
            content: '⭐ **Driver of the Day (DOTY) Voting is OPEN!**\nTime remaining: **1 Hour**',
            components: rows,
            fetchReply: true
        });

        // 3. Setup the Collector for 1 hour
        const collector = voteMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 3600000 // 1 Hour in ms
        });

        const userVoters = new Set(); // Track unique voters

        collector.on('collect', async i => {
            const votedId = i.customId.split('_')[1];

            if (userVoters.has(i.user.id)) {
                return i.reply({ content: '⚠️ You have already cast your vote!', ephemeral: true });
            }

            userVoters.add(i.user.id);
            voteCountMap.set(votedId, voteCountMap.get(votedId) + 1);

            await i.reply({ content: `✅ Vote recorded for <@${votedId}>!`, ephemeral: true });
        });

        collector.on('end', async () => {
            let winnerId = null;
            let maxVotes = 0;

            // Determine the winner
            for (const [id, count] of voteCountMap) {
                if (count > maxVotes) {
                    maxVotes = count;
                    winnerId = id;
                }
            }

            // Update drivers.json only if there's a winner
            if (winnerId) {
                const drivers = loadDrivers();
                let driver = drivers.find(d => d.userId === winnerId);

                if (driver) {
                    driver.doty = (driver.doty || 0) + 1;
                } else {
                    // If driver doesn't exist in DB, create a new entry
                    drivers.push({
                        userId: winnerId,
                        races: 0, wins: 0, podiums: 0, poles: 0, 
                        dnf: 0, dns: 0, wdc: 0, wcc: 0,
                        doty: 1
                    });
                }
                saveDrivers(drivers);
            }

            // Disable all buttons after voting ends
            const disabledRows = rows.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(btn => btn.setDisabled(true));
                return newRow;
            });

            const finalResult = winnerId 
                ? `🏆 **DOTY Winner:** <@${winnerId}> with **${maxVotes}** votes!`
                : '❌ Voting ended. No votes were cast.';

            await voteMsg.edit({
                content: `⭐ **Voting Closed!**\n\n${finalResult}`,
                components: disabledRows
            });
        });
    }
};
