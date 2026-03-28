const {
    Client,
    GatewayIntentBits,
    Collection,
    PermissionsBitField
} = require('discord.js');

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const driversPath = './drivers.json';

// ----------------------
// AUTO MIGRATE (ÖNEMLİ)
// ----------------------
function migrateIfNeeded() {
    try {
        const data = JSON.parse(fs.readFileSync(driversPath, 'utf8'));

        if (Array.isArray(data)) {
            console.log("⚠️ Old DB → migrating...");

            const newData = {};

            data.forEach(d => {
                newData[String(d.userId).trim()] = {
                    races: Number(d.races) || 0,
                    wins: Number(d.wins) || 0,
                    podiums: Number(d.podiums) || 0,
                    poles: Number(d.poles) || 0,
                    dnf: Number(d.dnf) || 0,
                    dns: Number(d.dns) || 0,
                    wdc: Number(d.wdc) || 0,
                    wcc: Number(d.wcc) || 0,
                    doty: Number(d.doty) || 0
                };
            });

            fs.writeFileSync(driversPath, JSON.stringify(newData, null, 2));
            console.log("✅ Migration done!");
        }
    } catch {
        fs.writeFileSync(driversPath, JSON.stringify({}, null, 2));
    }
}

migrateIfNeeded();

// ----------------------
// LOAD COMMANDS
// ----------------------
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath)) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// ----------------------
// READY
// ----------------------
client.once('ready', async () => {
    console.log(`ONLINE: ${client.user.tag}`);

    const data = client.commands.map(cmd => cmd.data.toJSON());
    await client.application.commands.set(data);
});

// ----------------------
// INTERACTION
// ----------------------
client.on('interactionCreate', async interaction => {

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(err);
        await interaction.reply({ content: '❌ Error', ephemeral: true });
    }
});

client.login(process.env.TOKEN);