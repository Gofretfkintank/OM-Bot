const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const driversFile = path.join(__dirname, '../drivers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Post race results and update statistics')
        .addStringOption(opt => opt.setName('track').setDescription('Track name').setRequired(true))
        .addStringOption(opt => 
            opt.setName('race_type')
                .setDescription('Race type (Sprint does not trigger voting)')
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
        .addStringOption(opt => opt.setName('dnf').setDescription('DNF users (comma separated)'))
        .addStringOption(opt => opt.setName('dns').setDescription('DNS users (comma separated)'))
        .addStringOption(opt => opt.setName('good_battles').setDescription('Optional battle comments')),

    async execute(interaction) {
        if (!interaction.channel) return; // DM/Null safety

        let drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));
        const track = interaction.options.getString('track');
        const raceType = interaction.options.getString('race_type');
        const goodBattles = interaction.options.getString('good_battles');

        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user) participants.push(user);
        }

        const participantIds = participants.map(p => p.id);

        // --- 1. STATS UPDATE (Fix: Double Race Bug) ---
        participants.forEach((user, index) => {
            const driver = drivers.find(d => d.userId === user.id);
            if (!driver) return; 

            driver.races = (Number(driver.races) || 0) + 1;
            if (index === 0) driver.wins = (Number(driver.wins) || 0) + 1;
            if (index <= 2) driver.podiums = (Number(driver.podiums) || 0) + 1;
        });

        // Handle DNF (Only +1 race if they aren't in the P1-10 list)
        const dnfInput = interaction.options.getString('dnf');
        if (dnfInput) {
            dnfInput.split(',').forEach(id => {
                const cleanId = id.replace(/[<@!>]/g, '').trim();
                const driver = drivers.find(d => d.userId === cleanId);
                if (driver) {
                    driver.dnf = (Number(driver.dnf) || 0) + 1;
                    if (!participantIds.includes(cleanId)) {
                        driver.races = (Number(driver.races) || 0) + 1;
                    }
                }
            });
        }

        // Handle DNS
        const dnsInput = interaction.options.getString('dns');
        if (dnsInput) {
            dnsInput.split(',').forEach(id => {
                const cleanId = id.replace(/[<@!>]/g, '').trim();
                const driver = drivers.find(d => d.userId === cleanId);
                if (driver) driver.dns = (Number(driver.dns) || 0) + 1;
            });
        }

        fs.writeFileSync(driversFile, JSON.stringify(drivers, null, 2));

        // --- 2. MESSAGE CONSTRUCTION ---
        let msg = `# ${track.toUpperCase()} STANDINGS\n\n**${raceType === 'gp' ? 'GRAND PRIX' : 'SPRINT'}**\n`;
        participants.forEach((user, i) => { msg += `P${i + 1}: ${user}\n`; });

        let lastPos = participants.length;
        if (dnfInput) dnfInput.split(',').forEach(id => { lastPos++; msg += `P${lastPos}: ${id.trim().includes('<@') ? id.trim() : `<@${id.trim()}>`} (DNF)\n`; });
        if (dnsInput) dnsInput.split(',').forEach(id => { lastPos++; msg += `P${lastPos}: ${id.trim().includes('<@') ? id.trim() : `<@${id.trim()}>`} (DNS)\n`; });

        if (goodBattles) msg += `\n**Good Battles:**\n${goodBattles}\n`;
        msg += `\n<@&1452705943967105046>`;

        // --- 3. BUTTONS & DOTY LOGIC ---
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

        const initialReply = await interaction.reply({ content: msg, components: components, fetchReply: true });

        // --- 4. AUTO-DOTY ANNOUNCEMENT (1 Hour Timer) ---
        if (raceType === 'gp') {
            const votingPeriod = 3600000; // 1 Hour in milliseconds
            
            setTimeout(async () => {
                try {
                    const updatedDrivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));
                    const messageId = initialReply.id;

                    let votes = [];
                    updatedDrivers.forEach(d => {
                        if (d.voters) {
                            // Secure matching using split
                            const raceVotes = d.voters.filter(v => v.split('_')[0] === messageId).length;
                            if (raceVotes > 0) {
                                votes.push({ userId: d.userId, count: raceVotes });
                            }
                        }
                    });

                    if (votes.length === 0) {
                        return interaction.channel.send("🏁 **Voting Period Ended:** No votes were cast for this race.");
                    }

                    // Sort to find the winner
                    votes.sort((a, b) => b.count - a.count);
                    const winnerId = votes[0].userId;
                    const winnerVotes = votes[0].count;

                    // Fetch winner details for the avatar
                    const winnerUser = await interaction.client.users.fetch(winnerId);

                    const embed = new EmbedBuilder()
                        .setTitle('🌟 DRIVER OF THE DAY')
                        .setDescription(`In the ${track.toUpperCase()} race, <@${winnerId}> was voted Driver of the Day with **${winnerVotes}** votes!`)
                        .setThumbnail(winnerUser.displayAvatarURL())
                        .setColor('#FFD700')
                        .setFooter({ text: 'Official Racing Stats' })
                        .setTimestamp();

                    await interaction.channel.send({ content: `<@${winnerId}>`, embeds: [embed] });

                    // Disable the button (Safe Edit)
                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('vote_doty')
                            .setLabel('Voting Closed')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                    await initialReply.edit({ components: [disabledRow] });
                } catch (e) {
                    console.error("Error announcing DOTY:", e);
                }

            }, votingPeriod);
        }
    }
};
