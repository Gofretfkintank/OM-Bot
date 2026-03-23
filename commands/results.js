const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const driversFile = path.join(__dirname, '../drivers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Post race results and update stats')
        .addStringOption(opt => opt.setName('track').setDescription('Track name').setRequired(true))
        .addStringOption(opt => opt.setName('race_type').setDescription('Sprint or Grand Prix').setRequired(true))
        .addUserOption(opt => opt.setName('p1').setDescription('1st Place').setRequired(true))
        .addStringOption(opt => opt.setName('good_battles').setDescription('Optional comments').setRequired(false))
        .addUserOption(opt => opt.setName('p2').setDescription('2nd Place').setRequired(false))
        .addUserOption(opt => opt.setName('p3').setDescription('3rd Place').setRequired(false))
        .addUserOption(opt => opt.setName('p4').setDescription('4th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p5').setDescription('5th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p6').setDescription('6th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p7').setDescription('7th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p8').setDescription('8th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p9').setDescription('9th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p10').setDescription('10th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p11').setDescription('11th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p12').setDescription('12th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p13').setDescription('13th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p14').setDescription('14th Place').setRequired(false))
        .addUserOption(opt => opt.setName('p15').setDescription('15th Place').setRequired(false))
        .addStringOption(opt => opt.setName('dnf').setDescription('Comma separated users for DNF').setRequired(false))
        .addStringOption(opt => opt.setName('dns').setDescription('Comma separated users for DNS').setRequired(false)),

    async execute(interaction) {
        let drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));

        const track = interaction.options.getString('track');
        const raceType = interaction.options.getString('race_type');
        const goodBattles = interaction.options.getString('good_battles');
        
        // Sadece seçilen p'leri topla
        const participants = [];
        for (let i = 1; i <= 15; i++) {
            const user = interaction.options.getUser(`p${i}`);
            if (user) participants.push(user);
        }

        // DNF/DNS listesi
        const dnfUsers = interaction.options.getString('dnf')?.split(',').map(u => u.trim()) || [];
        const dnsUsers = interaction.options.getString('dns')?.split(',').map(u => u.trim()) || [];

        // DB Güncelleme (İstatistikler)
        participants.forEach((user, index) => {
            const driver = drivers.find(d => d.userId === user.id);
            if (!driver) return;
            driver.races += 1;
            if (index === 0) { driver.wins += 1; driver.podiums += 1; driver.wdc += 25; }
            else if (index <= 2) { driver.podiums += 1; driver.wdc += (index === 1 ? 18 : 15); }
            else { driver.wdc += Math.max(0, 12 - (index - 3) * 2); }
        });

        fs.writeFileSync(driversFile, JSON.stringify(drivers, null, 2));

        // --- MESAJ FORMATI (TAM İSTEDİĞİN GİBİ) ---
        let msg = `# ${track.toUpperCase()} STANDINGS\n\n`;
        msg += `**${raceType.toUpperCase()}**\n`;

        // Sadece katılanları P1, P2 diye yazar
        participants.forEach((user, i) => {
            msg += `P${i + 1}: ${user}\n`;
        });

        // DNF ve DNS olanları da listeye ekle
        let lastPos = participants.length;
        dnfUsers.forEach(id => {
            lastPos++;
            msg += `P${lastPos}: ${id.includes('<@') ? id : `<@${id}>`} (DNF)\n`;
        });
        dnsUsers.forEach(id => {
            lastPos++;
            msg += `P${lastPos}: ${id.includes('<@') ? id : `<@${id}>`} (DNS)\n`;
        });

        if (goodBattles) {
            msg += `\nGood battles\n${goodBattles}\n`;
        }

        msg += `\n<@&1452705943967105046>`; 

        // DOTY Butonu
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('vote_doty')
                .setLabel('Vote for Driver of the Day')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🗳️')
        );

        await interaction.reply({ content: msg, components: [row] });
    }
};
