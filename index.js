const {
    Client,
    GatewayIntentBits,
    Collection,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ----------------------
// VIP SYSTEM
// ----------------------
const COMMANDER_ID = "1097807544849809408";
const CO_OWNER_ROLE_ID = "1447144645489328199";

// ----------------------
// GUILD WHITELIST
// ----------------------
const allowedGuilds = [
    process.env.GUILD_ID_1,
    process.env.GUILD_ID_2
].filter(Boolean);

// ----------------------
// DB PATH
// ----------------------
const driversFile = path.join(__dirname, 'drivers.json');

// ----------------------
// LOAD / SAVE (OBJECT DB)
// ----------------------
function loadDrivers() {
    try {
        if (!fs.existsSync(driversFile)) return {};
        return JSON.parse(fs.readFileSync(driversFile, 'utf8'));
    } catch {
        return {};
    }
}

function saveDrivers(data) {
    fs.writeFileSync(driversFile, JSON.stringify(data, null, 2));
}

// ----------------------
// COMMAND LOAD
// ----------------------
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// ----------------------
// EVENT LOAD
// ----------------------
const eventsPath = path.join(__dirname, 'events');

if (fs.existsSync(eventsPath)) {
    for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
        const event = require(`./events/${file}`);
        event(client);
        console.log(`📂 Event yüklendi: ${file}`);
    }
}

// ----------------------
// READY EVENT
// ----------------------
client.once('ready', async () => {
    console.log(`[ONLINE] ${client.user.tag}`);

    try {
        await client.application.commands.set([]);

        const data = client.commands.map(cmd => cmd.data.toJSON());

        for (const guildId of allowedGuilds) {
            await client.application.commands.set(data, guildId);
            console.log(`✅ Commands loaded: ${guildId}`);
        }

    } catch (err) {
        console.error("Setup error:", err);
    }
});

// ----------------------
// INTERACTION HANDLER
// ----------------------
client.on('interactionCreate', async interaction => {

    // ----------------------
    // SLASH COMMANDS
    // ----------------------
    if (interaction.isChatInputCommand()) {

        if (!allowedGuilds.includes(interaction.guildId)) {
            return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
        }

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);

            const isCommander = interaction.user.id === COMMANDER_ID;
            const isCoOwner = member.roles.cache.has(CO_OWNER_ROLE_ID);
            const hasFullPower = isCommander || isCoOwner;

            const modCommands = new Set(['mute', 'timeout', 'ban', 'kick']);

            if (modCommands.has(interaction.commandName)) {

                const target = interaction.options.getMember('target') || interaction.options.getMember('user');

                if (target) {

                    if (target.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                        return interaction.reply({
                            content: '❌ I cannot act on this user (role hierarchy).',
                            ephemeral: true
                        });
                    }

                    const targetIsStaff = target.permissions.has(PermissionsBitField.Flags.ManageMessages);

                    if (targetIsStaff && !hasFullPower) {
                        return interaction.reply({
                            content: '❌ Only VIPs can act on staff!',
                            ephemeral: true
                        });
                    }
                }
            }

            await command.execute(interaction);

        } catch (err) {
            console.error(`[ERROR] ${interaction.commandName}`, err);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ Error!', ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ content: '❌ Error!', ephemeral: true }).catch(() => {});
            }
        }
    }

    // ----------------------
    // DOTY BUTTON (SEÇİM MENÜSÜ)
    // ----------------------
    else if (interaction.isButton() && interaction.customId === 'vote_doty') {

        try {
            const userIds = [...interaction.message.mentions.users.keys()];
            if (userIds.length === 0) {
                return interaction.reply({ content: 'No drivers found!', ephemeral: true });
            }

            const row = new ActionRowBuilder();

            for (const id of userIds.slice(0, 5)) {
                let member;
                try {
                    member = await interaction.guild.members.fetch(id);
                } catch {
                    member = null;
                }

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_doty_${id}_${interaction.message.id}`)
                        .setLabel(member?.user.username || 'Driver')
                        .setStyle(ButtonStyle.Success)
                );
            }

            await interaction.reply({
                content: 'Select Driver of the Day:',
                components: [row],
                ephemeral: true
            });

        } catch (err) {
            console.error("Vote list error:", err);
        }
    }

    // ----------------------
    // DOTY CONFIRM
    // ----------------------
    else if (interaction.isButton() && interaction.customId.startsWith('confirm_doty_')) {

        try {
            const parts = interaction.customId.split('_');
            const votedUserId = parts[2];
            const msgId = parts.slice(3).join('_');

            const drivers = loadDrivers();

            const voteKey = `${msgId}_${interaction.user.id}`;

            const alreadyVoted = Object.values(drivers).some(d =>
                d.voters && d.voters.includes(voteKey)
            );

            if (alreadyVoted) {
                return interaction.reply({
                    content: '❌ You already voted!',
                    ephemeral: true
                });
            }

            if (!drivers[votedUserId]) {
                drivers[votedUserId] = {
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
            }

            drivers[votedUserId].doty++;
            drivers[votedUserId].voters.push(voteKey);

            saveDrivers(drivers);

            await interaction.update({
                content: `✅ Vote counted for <@${votedUserId}>!`,
                components: []
            });

        } catch (err) {
            console.error("Vote error:", err);
        }
    }
});

// ----------------------
// LOGIN
// ----------------------
client.login(process.env.TOKEN);