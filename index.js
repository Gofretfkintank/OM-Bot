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
// DRIVER MODEL
// ----------------------
const driverSchema = new mongoose.Schema({
    userId: String,
    races: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    podiums: { type: Number, default: 0 },
    poles: { type: Number, default: 0 },
    dnf: { type: Number, default: 0 },
    dns: { type: Number, default: 0 },
    wdc: { type: Number, default: 0 },
    wcc: { type: Number, default: 0 },
    doty: { type: Number, default: 0 },
    voters: { type: [String], default: [] }
});

const Driver = mongoose.model("Driver", driverSchema);

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
const COMMANDER_ID = "1097807544849809408";
const CO_OWNER_ROLE_ID = "1447144645489328199";

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
// INTERACTION
// ----------------------
client.on('interactionCreate', async interaction => {

    if (interaction.isChatInputCommand()) {

        if (!allowedGuilds.includes(interaction.guildId)) {
            return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
        }

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
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
    // DOTY BUTTON
    // ----------------------
    else if (interaction.isButton() && interaction.customId === 'vote_doty') {

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
    }

    // ----------------------
    // DOTY CONFIRM (🔥 MONGO)
    // ----------------------
    else if (interaction.isButton() && interaction.customId.startsWith('confirm_doty_')) {

        try {
            const parts = interaction.customId.split('_');
            const votedUserId = parts[2];
            const msgId = parts.slice(3).join('_');

            const voteKey = `${msgId}_${interaction.user.id}`;

            // 🔥 TÜM DRIVERLARDA VOTE KONTROL
            const alreadyVoted = await Driver.findOne({
                voters: voteKey
            });

            if (alreadyVoted) {
                return interaction.reply({
                    content: '❌ You already voted!',
                    ephemeral: true
                });
            }

            let driver = await Driver.findOne({ userId: votedUserId });

            if (!driver) {
                driver = new Driver({ userId: votedUserId });
            }

            driver.doty += 1;
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
client.login(process.env.TOKEN);