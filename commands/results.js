const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const driversFile = path.join(__dirname, '../drivers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Post race results and update stats (No Points)')
        .addStringOption(opt => opt.setName('track').setDescription('Track name').setRequired(true))
        .addStringOption(opt => opt.setName('race_type').setDescription('Sprint or Grand Prix').setRequired(true))
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
        .addStringOption(opt => opt.setName('dnf').setDescription('DNF users (id or mention, comma separated)'))
        .addStringOption(opt => opt.setName('dns').setDescription('DNS users (id or mention, comma separated)'))
        .addStringOption(opt => opt.setName('good_battles').setDescription('Optional comments')),

    async execute(interaction) {
        let drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));

        const track = interaction.options.getString('track');
        const raceType = interaction.options.getString('race_type');
        const goodBattles = interaction.options.getString('good_battles');

        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user) participants.push(user);
        }

        // --- STATS UPDATE ---
        participants.forEach((user, index) => {
            const driver = drivers.find(d => d.userId === user.id);
            if (!driver) return;

            driver.races += 1;
            if (index === 0) driver.wins += 1;
            if (index <= 2) driver.podiums += 1;
        });

        // DNF
        const dnfInput = interaction.options.getString('dnf');
        if (dnfInput) {
            dnfInput.split(',').forEach(id => {
                const cleanId = id.replace(/[<@!>]/g, '').trim();
                const driver = drivers.find(d => d.userId === cleanId);

                if (driver && !participants.some(p => p.id === cleanId)) {
                    driver.dnf += 1;
                    driver.races += 1;
                }
            });
        }

        // DNS
        const dnsInput = interaction.options.getString('dns');
        if (dnsInput) {
            dnsInput.split(',').forEach(id => {
                const cleanId = id.replace(/[<@!>]/g, '').trim();
                const driver = drivers.find(d => d.userId === cleanId);
                if (driver) driver.dns += 1;
            });
        }

        fs.writeFileSync(driversFile, JSON.stringify(drivers, null, 2));

        // --- MESSAGE ---
        let msg = `# ${track.toUpperCase()} STANDINGS\n\n**${raceType.toUpperCase()}**\n`;

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
            msg += `\nGood battles\n${goodBattles}\n`;
        }

        msg += `\n<@&1452705943967105046>`;

        // DOTY BUTTON
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('vote_doty')
                .setLabel('Vote Driver of the Day')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🗳️')
        );

        await interaction.reply({ content: msg, components: [row] });
    }
};