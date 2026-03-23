const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

// GUILD WHITELIST
const allowedGuilds = [
    process.env.GUILD_ID_1,
    process.env.GUILD_ID_2
].filter(Boolean);

// COMMAND LOAD
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// READY EVENT
client.once('ready', async () => {
    console.log(`[ONLINE] ${client.user.tag} is running! 🚀`);

    try {
        // Global komutları temizle (çakışmayı önler)
        await client.application.commands.set([]);

        const commandsData = client.commands.map(cmd => cmd.data.toJSON());

        for (const guildId of allowedGuilds) {
            try {
                // Komutları cache beklemeden direkt o sunucuya zorla kaydet
                await client.application.commands.set(commandsData, guildId);
                console.log(`✅ Commands successfully pushed to Guild: ${guildId}`);
            } catch (guildErr) {
                console.error(`❌ Failed to push commands to guild ${guildId}:`, guildErr);
            }
        }
    } catch (err) {
        console.error('❌ General setup error:', err);
    }
});

// INTERACTION HANDLER
client.on('interactionCreate', async interaction => {

    // ----------------------
    // 1. SLASH COMMANDS
    // ----------------------
    if (interaction.isChatInputCommand()) {

        if (!allowedGuilds.includes(interaction.guildId)) {
            return interaction.reply({
                content: '❌ Not allowed here.',
                ephemeral: true
            });
        }

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(`[ERROR] /${interaction.commandName}`, err);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: '❌ Error executing command!',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ Error executing command!',
                    ephemeral: true
                });
            }
        }
    }

    // ----------------------
    // 2. DOTY BUTTON (LIST)
    // ----------------------
    else if (interaction.isButton() && interaction.customId === 'vote_doty') {

        const pilotIds = [...interaction.message.mentions.users.keys()];

        if (pilotIds.length === 0) {
            return interaction.reply({
                content: 'No pilots found!',
                ephemeral: true
            });
        }

        const row = new ActionRowBuilder();

        pilotIds.slice(0, 5).forEach((id) => {
            const member = interaction.guild.members.cache.get(id);

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_doty_${id}_${interaction.message.id}`)
                    .setLabel(member?.user.username || 'Driver')
                    .setStyle(ButtonStyle.Success)
            );
        });

        await interaction.reply({
            content: 'Select Driver of the Day:',
            components: [row],
            ephemeral: true
        });
    }

    // ----------------------
    // 3. DOTY CONFIRM
    // ----------------------
    else if (interaction.isButton() && interaction.customId.startsWith('confirm_doty_')) {

        const parts = interaction.customId.split('_');
        const votedUserId = parts[2];
        const msgId = parts.slice(3).join('_');

        const driversFile = path.join(__dirname, 'drivers.json');
        let drivers = [];
        
        // Dosya kontrolü eklendi
        if (fs.existsSync(driversFile)) {
            drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));
        }

        const voteKey = `${msgId}_${interaction.user.id}`;

        // GLOBAL VOTE CHECK
        const alreadyVoted = drivers.some(d =>
            d.voters && d.voters.includes(voteKey)
        );

        if (alreadyVoted) {
            return interaction.reply({
                content: '❌ You already voted in this race!',
                ephemeral: true
            });
        }

        const driver = drivers.find(d => d.userId === votedUserId);

        if (!driver) {
            return interaction.reply({
                content: 'Driver not found!',
                ephemeral: true
            });
        }

        if (!driver.voters) driver.voters = [];

        driver.voters.push(voteKey);
        driver.doty = (driver.doty || 0) + 1;

        fs.writeFileSync(driversFile, JSON.stringify(drivers, null, 2));

        await interaction.update({
            content: `✅ Vote counted for <@${votedUserId}>!`,
            components: []
        });
    }
});

// EXTRA EVENTS
require('./events/raceTimer')(client);

// LOGIN
client.login(process.env.TOKEN);
