const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const driversFile = path.join(__dirname, '../drivers.json');

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Post race results and update statistics')

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

        .addStringOption(opt => 
            opt.setName('dnf')
                .setDescription('DNF drivers (comma separated)')
        )

        .addStringOption(opt => 
            opt.setName('dns')
                .setDescription('DNS drivers (comma separated)')
        )

        .addStringOption(opt => 
            opt.setName('good_battles')
                .setDescription('Optional race comments')
        ),

    async execute(interaction) {
        if (!interaction.channel) return;

        let drivers = loadDrivers();

        const track = interaction.options.getString('track');
        const raceType = interaction.options.getString('race_type');
        const goodBattles = interaction.options.getString('good_battles');

        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user) participants.push(user);
        }

        const participantIds = participants.map(p => p.id);

        // --- STATS ---
        participants.forEach((user, index) => {
            let driver = drivers.find(d => d.userId === user.id);
            if (!driver) return;

            if (!driver.voters) driver.voters = [];

            driver.races = (Number(driver.races) || 0) + 1;
            if (index === 0) driver.wins = (Number(driver.wins) || 0) + 1;
            if (index <= 2) driver.podiums = (Number(driver.podiums) || 0) + 1;
        });

        // --- DNF ---
        const dnfInput = interaction.options.getString('dnf');
        if (dnfInput) {
            dnfInput.split(',').forEach(id => {
                const cleanId = id.replace(/[<@!>]/g, '').trim();
                let driver = drivers.find(d => d.userId === cleanId);
                if (!driver) return;

                if (!driver.voters) driver.voters = [];

                driver.dnf = (Number(driver.dnf) || 0) + 1;

                if (!participantIds.includes(cleanId)) {
                    driver.races = (Number(driver.races) || 0) + 1;
                }
            });
        }

        // --- DNS ---
        const dnsInput = interaction.options.getString('dns');
        if (dnsInput) {
            dnsInput.split(',').forEach(id => {
                const cleanId = id.replace(/[<@!>]/g, '').trim();
                let driver = drivers.find(d => d.userId === cleanId);
                if (!driver) return;

                if (!driver.voters) driver.voters = [];

                driver.dns = (Number(driver.dns) || 0) + 1;
            });
        }

        saveDrivers(drivers);

        // --- MESSAGE ---
        let msg = `# ${track.toUpperCase()} STANDINGS\n\n**${raceType === 'gp' ? 'GRAND PRIX' : 'SPRINT'}**\n`;

        participants.forEach((user, i) => {
            msg += `P${i + 1}: ${user}\n`;
        });

        let lastPos = participants.length;

        if (dnfInput) {
            dnfInput.split(',').forEach(id => {
                lastPos++;
                msg += `P${lastPos}: ${id.trim().includes('<@') ? id.trim() : `<@${id.trim()}>`} (DNF)\n`;
            });
        }

        if (dnsInput) {
            dnsInput.split(',').forEach(id => {
                lastPos++;
                msg += `P${lastPos}: ${id.trim().includes('<@') ? id.trim() : `<@${id.trim()}>`} (DNS)\n`;
            });
        }

        if (goodBattles) {
            msg += `\n**Good Battles:**\n${goodBattles}\n`;
        }

        msg += `\n<@&1452705943967105046>`;

        const components = [];

        if (raceType === 'gp') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('vote_doty')
                    .setLabel('Vote for Driver of the Day')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🗳️')
            );
            components.push(row);
        }

        const initialReply = await interaction.reply({
            content: msg,
            components,
            fetchReply: true
        });

        // --- DOTY TIMER ---
        if (raceType === 'gp') {
            setTimeout(async () => {
                try {
                    let updatedDrivers = loadDrivers();
                    const messageId = initialReply.id;

                    let votes = [];

                    updatedDrivers.forEach(d => {
                        if (!d.voters) return;

                        const raceVotes = d.voters.filter(v => v.split('_')[0] === messageId).length;

                        if (raceVotes > 0) {
                            votes.push({ userId: d.userId, count: raceVotes });
                        }
                    });

                    if (votes.length === 0) {
                        return interaction.channel.send("🏁 No votes cast.");
                    }

                    votes.sort((a, b) => b.count - a.count);

                    const topVotes = votes[0].count;
                    const winners = votes.filter(v => v.count === topVotes);

                    // ✅ ONLY WINNER GETS DOTY
                    if (winners.length === 1) {
                        const winner = updatedDrivers.find(d => d.userId === winners[0].userId);
                        if (winner) {
                            winner.doty = (Number(winner.doty) || 0) + 1;
                        }
                    }

                    let text;
                    if (winners.length === 1) {
                        text = `<@${winners[0].userId}> wins DOTY with **${topVotes}** votes!`;
                    } else {
                        text = winners.map(w => `<@${w.userId}>`).join(', ') + ` tied with **${topVotes}** votes!`;
                    }

                    const winnerUser = await interaction.client.users.fetch(winners[0].userId);

                    const embed = new EmbedBuilder()
                        .setTitle('🌟 DRIVER OF THE DAY')
                        .setDescription(text)
                        .setThumbnail(winnerUser.displayAvatarURL())
                        .setColor('#FFD700')
                        .setTimestamp();

                    await interaction.channel.send({ embeds: [embed] });

                    // CLEAN VOTERS
                    updatedDrivers.forEach(d => {
                        if (d.voters) {
                            d.voters = d.voters.filter(v => !v.startsWith(messageId));
                        }
                    });

                    saveDrivers(updatedDrivers);

                    // DISABLE BUTTON
                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('vote_doty')
                            .setLabel('Voting Closed')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                    await initialReply.edit({ components: [disabledRow] });

                } catch (err) {
                    console.error('DOTY error:', err);
                }
            }, 3600000);
        }
    }
};