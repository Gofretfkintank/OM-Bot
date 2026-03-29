const {
    Client,
    GatewayIntentBits,
    Collection,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} = require('discord.js');

require('dotenv').config();
const mongoose = require('mongoose');

// ----------------------
// MONGO CONNECT
// ----------------------
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("🟢 MongoDB bağlandı"))
.catch(err => console.error("Mongo hata:", err));

// ----------------------
// MODEL
// ----------------------
const Driver = require('./models/Driver');

// ----------------------
// CLIENT
// ----------------------
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
// COMMAND LOAD
// ----------------------
client.commands = new Collection();
const fs = require('fs');
const path = require('path');

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
// READY
// ----------------------
client.once('clientReady', async () => {
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
// INTERACTION
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
                            content: '❌ I cannot act on this user.',
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
    // DOTY CONFIRM (MONGO 🔥)
    // ----------------------
    else if (interaction.isButton() && interaction.customId.startsWith('confirm_doty_')) {

        try {
            const parts = interaction.customId.split('_');
            const votedUserId = parts[2];
            const msgId = parts.slice(3).join('_');

            const voteKey = `${msgId}_${interaction.user.id}`;

            let driver = await Driver.findOne({ userId: votedUserId });

            if (!driver) {
                driver = new Driver({ userId: votedUserId });
            }

            if (driver.voters.includes(voteKey)) {
                return interaction.reply({
                    content: '❌ You already voted!',
                    ephemeral: true
                });
            }

            driver.doty++;
            driver.voters.push(voteKey);

            await driver.save();

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