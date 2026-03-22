// commands/results.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const driversFile = path.join(__dirname, '../drivers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Post race results and update stats')
        .addStringOption(option => 
            option.setName('track')
                  .setDescription('Track name')
                  .setRequired(true))
        .addStringOption(option => 
            option.setName('race_type')
                  .setDescription('Sprint or Grand Prix')
                  .setRequired(true))
        .addUserOption(option =>
            option.setName('p1')
                  .setDescription('First place')
                  .setRequired(true))
        .addStringOption(option =>
            option.setName('good_battles')
                  .setDescription('Optional comments about the race')
                  .setRequired(false))
        .addUserOption(option =>
            option.setName('p2')
                  .setDescription('Second place')
                  .setRequired(false))
        .addUserOption(option =>
            option.setName('p3')
                  .setDescription('Third place')
                  .setRequired(false))
        .addUserOption(option =>
            option.setName('p4')
                  .setDescription('Fourth place')
                  .setRequired(false))
        .addUserOption(option =>
            option.setName('p5')
                  .setDescription('Fifth place')
                  .setRequired(false))
        .addStringOption(option =>
            option.setName('dnf')
                  .setDescription('Comma separated users who DNF')
                  .setRequired(false))
        .addStringOption(option =>
            option.setName('dns')
                  .setDescription('Comma separated users who DNS')
                  .setRequired(false)),
    
    async execute(interaction) {
        // Read drivers.json
        let drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));

        const track = interaction.options.getString('track');
        const raceType = interaction.options.getString('race_type');
        const goodBattles = interaction.options.getString('good_battles') || '';
        
        // Collect participants
        const participants = [];
        for (let i = 1; i <= 15; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user) participants.push(user);
        }

        // DNF/DNS
        const dnfUsers = interaction.options.getString('dnf')?.split(',').map(u => u.trim()) || [];
        const dnsUsers = interaction.options.getString('dns')?.split(',').map(u => u.trim()) || [];

        // Update stats
        participants.forEach((user, index) => {
            const driver = drivers.find(d => d.userId === user.id);
            if (!driver) return;

            driver.races += 1;

            if (index === 0) {
                driver.wins += 1;
                driver.podiums += 1;
                driver.wdc += 25; // örnek puan
            } else if (index <= 2) {
                driver.podiums += 1;
                driver.wdc += 18 - (index-1)*3; // 2. 18, 3. 15 gibi örnek
            } else {
                driver.wdc += 12 - (index-3)*2; // 4-15 arası puan örnek
            }
        });

        // DNF/DNS update
        dnfUsers.forEach(id => {
            const driver = drivers.find(d => d.userId === id);
            if (driver) {
                driver.races += 1;
                driver.dnf += 1;
            }
        });

        dnsUsers.forEach(id => {
            const driver = drivers.find(d => d.userId === id);
            if (driver) {
                driver.races += 1;
                driver.dns += 1;
            }
        });

        // Save drivers.json
        fs.writeFileSync(driversFile, JSON.stringify(drivers, null, 2));

        // Build standings message
        let msg = `# ${track.toUpperCase()} STANDINGS\n\n**${raceType.toUpperCase()}**\n`;
        participants.forEach((user, i) => {
            msg += `P${i+1}: ${user}\n`;
        });

        dnfUsers.forEach((id, i) => {
            msg += `P${participants.length + i + 1}: <@${id}> (DNF)\n`;
        });

        dnsUsers.forEach((id, i) => {
            msg += `P${participants.length + dnfUsers.length + i + 1}: <@${id}> (DNS)\n`;
        });

        if (goodBattles) msg += `\nGood battles\n${goodBattles}\n`;

        msg += `\n<@&1452705943967105046>`;

        // Send message
        await interaction.reply({ content: msg });
    }
};
