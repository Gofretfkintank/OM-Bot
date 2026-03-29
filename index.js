//--------------------------
// IMPORTS
//--------------------------

const {
    Client,
    GatewayIntentBits,
    Collection,
    PermissionsBitField
} = require('discord.js');

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

//--------------------------
// MONGO CONNECT
//--------------------------

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🟢 MongoDB bağlandı"))
    .catch(err => console.error("Mongo hata:", err));

//--------------------------
// MODELS
//--------------------------

const Driver = require('./models/Driver');
const DotyVote = require('./models/DotyVote');

//--------------------------
// CLIENT
//--------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

//--------------------------
// VIP SYSTEM
//--------------------------

const COMMANDER_ID = "1097807544849809408";
const CO_OWNER_ROLE_ID = "1447144645489328199";

//--------------------------
// GUILD WHITELIST
//--------------------------

const allowedGuilds = [
    process.env.GUILD_ID_1,
    process.env.GUILD_ID_2
].filter(Boolean);

//--------------------------
// COMMAND LOAD
//--------------------------

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

//--------------------------
// EVENT LOAD
//--------------------------

const eventsPath = path.join(__dirname, 'events');

if (fs.existsSync(eventsPath)) {
    for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
        const event = require(`./events/${file}`);
        event(client);
        console.log(`📂 Event yüklendi: ${file}`);
    }
}

//--------------------------
// READY
//--------------------------

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

    //--------------------------
    // DOTY AUTO END SYSTEM
    //--------------------------

    setInterval(async () => {

        try {

            const votes = await DotyVote.find({
                finished: false,
                endTime: { $lte: Date.now() }
            });

            for (const vote of votes) {

                try {

                    const channel = await client.channels.fetch(vote.channelId).catch(() => null);
                    if (!channel) continue;

                    const message = await channel.messages.fetch(vote.messageId).catch(() => null);

                    //--------------------------
                    // CALCULATE RESULT
                    //--------------------------

                    let max = 0;

                    for (const v of vote.votes.values()) {
                        if (v > max) max = v;
                    }

                    const winners = [];

                    for (const [id, v] of vote.votes) {
                        if (v === max && max > 0) {
                            winners.push(id);
                        }
                    }

                    //--------------------------
                    // RESULT CASES
                    //--------------------------

                    if (winners.length === 0) {

                        if (message) {
                            await message.reply('❌ No votes.');
                        }

                    } else if (winners.length > 1) {

                        if (message) {
                            await message.reply(
                                `🤝 Tie:\n${winners.map(id => `<@${id}>`).join('\n')} (${max} votes)`
                            );
                        }

                    } else {

                        const winner = winners[0];

                        await Driver.findOneAndUpdate(
                            { userId: winner },
                            { $inc: { doty: 1 } },
                            { upsert: true }
                        );

                        if (message) {
                            await message.reply(
                                `🏆 Winner: <@${winner}> with ${max} votes!`
                            );
                        }
                    }

                    //--------------------------
                    // DISABLE BUTTONS
                    //--------------------------

                    if (message) {
                        await message.edit({ components: [] }).catch(() => {});
                    }

                    //--------------------------
                    // MARK FINISHED
                    //--------------------------

                    vote.finished = true;
                    await vote.save();

                } catch (err) {
                    console.error('END ERROR:', err);
                }
            }

        } catch (err) {
            console.error('AUTO LOOP ERROR:', err);
        }

    }, 15000);
});

//--------------------------
// INTERACTION
//--------------------------

client.on('interactionCreate', async interaction => {

    //--------------------------
    // SLASH COMMANDS
    //--------------------------

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

    //--------------------------
    // DOTY BUTTON SYSTEM
    //--------------------------

    else if (interaction.isButton() && interaction.customId.startsWith('doty_')) {

        try {

            const votedUserId = interaction.customId.split('_')[1];

            const vote = await DotyVote.findOne({
                messageId: interaction.message.id,
                finished: false
            });

            if (!vote) {
                return interaction.reply({ content: 'Vote not found.', ephemeral: true });
            }

            if (Date.now() > vote.endTime) {
                return interaction.reply({ content: 'Voting ended.', ephemeral: true });
            }

            if (vote.voters.includes(interaction.user.id)) {
                return interaction.reply({ content: 'Already voted.', ephemeral: true });
            }

            //--------------------------
            // SAVE VOTE
            //--------------------------

            vote.voters.push(interaction.user.id);

            vote.votes.set(
                votedUserId,
                (vote.votes.get(votedUserId) || 0) + 1
            );

            await vote.save();

            await interaction.reply({
                content: 'Vote counted.',
                ephemeral: true
            });

        } catch (err) {
            console.error('VOTE ERROR:', err);
        }
    }
});

//--------------------------
// LOGIN
//--------------------------

client.login(process.env.TOKEN);