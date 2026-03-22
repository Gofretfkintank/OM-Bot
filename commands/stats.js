// commands/stats.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('path');

const driversFile = path.join(__dirname, '../drivers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show racing stats for a user')
        .addUserOption(option =>
            option.setName('user')
                  .setDescription('The user to view stats for')
                  .setRequired(false)),
    
    async execute(interaction) {
        // Hedef kullanıcı
        const targetUser = interaction.options.getUser('user') || interaction.user;

        // JSON oku
        let drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));
        const driver = drivers.find(d => d.userId === targetUser.id);

        if (!driver) {
            return interaction.reply({ content: `❌ No stats found for ${targetUser.tag}`, ephemeral: true });
        }

        // Stats mesajı
        let msg = `🏎️ **Stats for ${targetUser.tag}**\n\n` +
                  `Races: ${driver.races}\n` +
                  `Wins: ${driver.wins} 🏆\n` +
                  `Podiums: ${driver.podiums} 🥇🥈🥉\n` +
                  `DNF: ${driver.dnf} 💀\n` +
                  `DNS: ${driver.dns} ⚡\n` +
                  `WDC: ${driver.wdc}\n` +
                  `WCC: ${driver.wcc}`;

        // Mesajı gönder
        await interaction.reply({ content: msg, ephemeral: false });
    }
};