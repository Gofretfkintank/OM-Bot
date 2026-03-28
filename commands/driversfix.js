const { 
    SlashCommandBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');

const driversPath = './drivers.json';

// --------------------
// LOAD / SAVE
// --------------------
const loadDrivers = () => {
    try {
        const data = JSON.parse(fs.readFileSync(driversPath, 'utf8'));

        // Normalize (çok önemli)
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
        .setName('driversfix')
        .setDescription('Modify a driver statistics safely.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addUserOption(opt => 
            opt.setName('user')
                .setDescription('Driver to modify')
                .setRequired(true))

        .addStringOption(opt => 
            opt.setName('stat')
                .setDescription('Stat to modify')
                .setRequired(true)
                .addChoices(
                    { name: 'Races', value: 'races' },
                    { name: 'Wins', value: 'wins' },
                    { name: 'Podiums', value: 'podiums' },
                    { name: 'Poles', value: 'poles' },
                    { name: 'DOTY', value: 'doty' },
                    { name: 'DNF', value: 'dnf' },
                    { name: 'DNS', value: 'dns' }
                ))

        .addIntegerOption(opt => 
            opt.setName('amount')
                .setDescription('Amount to add or subtract (e.g. 1, -1, 5)')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const stat = interaction.options.getString('stat');
        const amount = interaction.options.getInteger('amount');

        let drivers = loadDrivers();
        let driver = getDriver(drivers, targetUser.id);

        // --------------------
        // APPLY CHANGE
        // --------------------
        const oldValue = Number(driver[stat]) || 0;
        let newValue = oldValue + amount;

        // negatif engelle
        if (newValue < 0) newValue = 0;

        driver[stat] = newValue;

        saveDrivers(drivers);

        // --------------------
        // RESPONSE
        // --------------------
        const changeText = `${amount > 0 ? '+' : ''}${amount}`;

        await interaction.reply({
            content:
`✅ **Driver Updated**

👤 User: <@${targetUser.id}>
📊 Stat: **${stat.toUpperCase()}**

Old: \`${oldValue}\`
New: \`${newValue}\`
Change: \`${changeText}\``,
            ephemeral: false
        });
    }
};