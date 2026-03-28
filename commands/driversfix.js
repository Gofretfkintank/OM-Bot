const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const driversPath = path.join(__dirname, '../drivers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('driversfix')
        .setDescription('Edit driver stats')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('Target user')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('stat')
                .setDescription('Stat to edit')
                .setRequired(true)
                .addChoices(
                    { name: 'races', value: 'races' },
                    { name: 'wins', value: 'wins' },
                    { name: 'podiums', value: 'podiums' },
                    { name: 'poles', value: 'poles' },
                    { name: 'dnf', value: 'dnf' },
                    { name: 'dns', value: 'dns' },
                    { name: 'wdc', value: 'wdc' },
                    { name: 'wcc', value: 'wcc' },
                    { name: 'doty', value: 'doty' }
                )
        )
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to add/remove')
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const stat = interaction.options.getString('stat');
        const amount = interaction.options.getInteger('amount');

        const drivers = JSON.parse(fs.readFileSync(driversPath, 'utf8'));

        if (!drivers[user.id]) {
            drivers[user.id] = {
                races: 0, wins: 0, podiums: 0,
                poles: 0, dnf: 0, dns: 0,
                wdc: 0, wcc: 0, doty: 0
            };
        }

        drivers[user.id][stat] =
            Math.max(0, (drivers[user.id][stat] || 0) + amount);

        fs.writeFileSync(driversPath, JSON.stringify(drivers, null, 2));

        await interaction.reply(`✅ Updated ${stat}`);
    }
};