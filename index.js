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
const http = require('http'); // Added for Passive Monitoring (Heartbeat)

//--------------------------
// MONGO CONNECT
//--------------------------

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🟢 MongoDB connected successfully"))
    .catch(err => console.error("MongoDB connection error:", err));

//--------------------------
// MODELS
//--------------------------

const Driver = require('./models/Driver');
const DotyVote = require('./models/DotyVote');
const SeasonVote = require('./models/SeasonVote');
const Maintenance = require('./models/Maintenance');
const { onStartup: teamRadioStartup } = require('./commands/teamradio');

//--------------------------
// CLIENT
//--------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
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
        console.log(`📂 Event loaded: ${file}`);
    }
}

//--------------------------
// COMMAND HASH HELPER
//--------------------------

function hashCommand(cmd) {
    try {
        return JSON.stringify(cmd.data.toJSON());
    } catch {
        return String(cmd.data.name);
    }
}

//--------------------------
// READY
//--------------------------

client.once('ready', async () => {

    console.log(`[ONLINE] ${client.user.tag}`);

    // TeamRadio restart-safe scheduler
    await teamRadioStartup(client);

    try {
        await client.application.commands.set([]);

        const data = client.commands.map(cmd => cmd.data.toJSON());

        for (const guildId of allowedGuilds) {
            await client.application.commands.set(data, guildId);
            console.log(`✅ Commands deployed to: ${guildId}`);
        }

        //--------------------------
        // MAINTENANCE SNAPSHOT CHECK
        //--------------------------

        try {
            const state = await Maintenance.findById('singleton');

            if (state && state.active && state.snapshot) {

                const newLocked = [];

                for (const [name, cmd] of client.commands) {
                    const oldHash = state.snapshot instanceof Map ? state.snapshot.get(name) : state.snapshot[name];
                    const newHash = hashCommand(cmd);

                    if (!oldHash) {
                        newLocked.push(name);
                        console.log(`🔧 [MAINTENANCE] New command detected: /${name}`);
                    }
                    else if (oldHash !== newHash) {
                        newLocked.push(name);
                        console.log(`🔧 [MAINTENANCE] Modified command detected: /${name}`);
                    }
                }

                if (newLocked.length > 0) {
                    state.lockedCommands = newLocked;
                    await state.save();
                    console.log(`🔧 [MAINTENANCE] Locked commands: ${newLocked.join(', ')}`);
                } else {
                    console.log(`🔧 [MAINTENANCE] Mode is active but no command changes detected.`);
                }
            }
        } catch (err) {
            console.error('[MAINTENANCE] Snapshot check error:', err);
        }

    } catch (err) {
        console.error("Setup error:", err);
    }

    //--------------------------
    // DOTY AUTO END LOOP
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

                    if (winners.length === 0) {
                        if (message) await message.reply('❌ No votes recorded.');
                    } else if (winners.length > 1) {
                        if (message) {
                            await message.reply(
                                `🤝 **It's a Tie!**\n${winners.map(id => `<@${id}>`).join('\n')} (${max} votes each)`
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
                                `🏆 **Driver of the Day:** <@${winner}> with **${max}** votes!`
                            );
                        }
                    }

                    if (message) {
                        await message.edit({ components: [] }).catch(() => {});
                    }

                    vote.finished = true;
                    await vote.save();

                } catch (err) {
                    console.error('VOTE END ERROR:', err);
                }
            }
        } catch (err) {
            console.error('AUTO LOOP ERROR:', err);
        }
    }, 15000);

    //--------------------------
    // DOTS / TOTS AUTO END LOOP
    //--------------------------

    setInterval(async () => {
        try {
            const seasonVotes = await SeasonVote.find({
                finished: false,
                endTime: { $lte: Date.now() }
            });

            for (const vote of seasonVotes) {
                try {
                    const channel = await client.channels.fetch(vote.channelId).catch(() => null);
                    if (!channel) continue;

                    const message = await channel.messages.fetch(vote.messageId).catch(() => null);

                    let max = 0;
                    for (const v of vote.votes.values()) {
                        if (v > max) max = v;
                    }

                    const winners = [];
                    for (const [key, v] of vote.votes) {
                        if (v === max && max > 0) winners.push(key);
                    }

                    const { EmbedBuilder } = require('discord.js');

                    const makeSeasonBar = (count, total) => {
                        const pct = total === 0 ? 0 : count / total;
                        const filled = Math.round(pct * 12);
                        return '█'.repeat(filled) + '░'.repeat(12 - filled);
                    };

                    const total = vote.participants.reduce((s, p) => s + (vote.votes.get(p) || 0), 0);
                    const isDots = vote.type === 'dots';
                    const typeLabel = isDots ? 'DRIVER OF THE SEASON' : 'TEAM OF THE SEASON';

                    const resultLines = [...vote.participants]
                        .sort((a, b) => (vote.votes.get(b) || 0) - (vote.votes.get(a) || 0))
                        .map(p => {
                            const v = vote.votes.get(p) || 0;
                            const pct = total === 0 ? 0 : Math.round((v / total) * 100);
                            const label = isDots ? `<@${p}>` : `**${p}**`;
                            return `${label}\n\`${makeSeasonBar(v, total)}\` **${v}** votes (${pct}%)`;
                        })
                        .join('\n\n');

                    let winnerText;
                    if (winners.length === 0) {
                        winnerText = '❌ No votes were cast.';
                    } else if (winners.length > 1) {
                        const wLabels = winners.map(w => isDots ? `<@${w}>` : `**${w}**`).join(' & ');
                        winnerText = `🤝 TIE: ${wLabels}`;
                    } else {
                        const wLabel = isDots ? `<@${winners[0]}>` : `**${winners[0]}**`;
                        winnerText = `🏆 WINNER: ${wLabel}`;
                    }

                    const resultEmbed = new EmbedBuilder()
                        .setTitle(`🏆 ${typeLabel} — RESULTS`)
                        .setColor(0xFFD700)
                        .setDescription(`**${winnerText}**\n\n${resultLines}`)
                        .setFooter({ text: `Total votes: ${total} • Voting ended` });

                    if (message) {
                        await message.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
                    }

                    vote.finished = true;
                    await vote.save();

                } catch (err) {
                    console.error('[SEASON VOTE END ERROR]', err);
                }
            }
        } catch (err) {
            console.error('[SEASON VOTE LOOP ERROR]', err);
        }
    }, 15000);

});

//--------------------------
// INTERACTION HANDLER
//--------------------------

client.on('interactionCreate', async interaction => {

    if (interaction.isChatInputCommand()) {

        if (!allowedGuilds.includes(interaction.guildId)) {
            return interaction.reply({ content: '❌ Access denied for this server.', ephemeral: true });
        }

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const isCommander = interaction.user.id === COMMANDER_ID;
            const isCoOwner = member.roles.cache.has(CO_OWNER_ROLE_ID);
            const hasFullPower = isCommander || isCoOwner;
            const isStaff = member.permissions.has(PermissionsBitField.Flags.ManageMessages);

            //--------------------------
            // MAINTENANCE & ABSOLUTE LOCKDOWN
            //--------------------------

            if (interaction.commandName !== 'maintenance') {
                try {
                    const state = await Maintenance.findById('singleton');
                    const isMaintenanceActive = state?.active;
                    const isCommandLocked = state?.lockedCommands?.includes(interaction.commandName);

                    // Sadece lockedCommands listesindeki komutları engelle.
                    // isMaintenanceActive tek başına yeterli değil — bakım açık olsa bile
                    // değişmeyen komutlar normal çalışmaya devam etmeli.
                    if (isCommandLocked) {
                        
                        // ABSOLUTE LOCKDOWN: Only the bot creator (Gofret) can bypass this.
                        if (!isCommander) {
                            return interaction.reply({
                                content: [
                                    `🔒 **COMMAND LOCKED**`,
                                    ``,
                                    `**Gofret (the coder)** is currently cooking some wafers in the backend 🧇`,
                                    `*This command is strictly restricted to Developer override only.*`,
                                    ``,
                                    `Please wait until the system is back online.`
                                ].join('\n'),
                                ephemeral: true
                            });
                        }
                    }
                } catch (err) {
                    console.error('[MAINTENANCE] Check error:', err);
                }
            }

            // Moderation Command Protection
            const modCommands = new Set(['mute', 'timeout', 'ban', 'kick']);

            if (modCommands.has(interaction.commandName)) {
                const target = interaction.options.getMember('target') || interaction.options.getMember('user');

                if (target) {
                    if (target.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                        return interaction.reply({
                            content: '❌ I cannot perform actions on this user due to role hierarchy.',
                            ephemeral: true
                        });
                    }

                    const targetIsStaff = target.permissions.has(PermissionsBitField.Flags.ManageMessages);

                    if (targetIsStaff && !hasFullPower) {
                        return interaction.reply({
                            content: '❌ Only VIPs (Commander/Co-Owner) can perform actions on staff members!',
                            ephemeral: true
                        });
                    }
                }
            }

            await command.execute(interaction);

        } catch (err) {
            console.error(`[EXECUTION ERROR] ${interaction.commandName}:`, err);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ An unexpected error occurred while executing the command.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ content: '❌ An unexpected error occurred while executing the command.', ephemeral: true }).catch(() => {});
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
                return interaction.reply({ content: '❌ Active voting session not found.', ephemeral: true });
            }

            if (Date.now() > vote.endTime) {
                return interaction.reply({ content: '❌ Voting session has ended.', ephemeral: true });
            }

            if (!vote.participants.includes(votedUserId)) {
                return interaction.reply({ content: '❌ Invalid candidate selection.', ephemeral: true });
            }

            if (vote.voters.includes(interaction.user.id)) {
                return interaction.reply({ content: '❌ You have already cast your vote.', ephemeral: true });
            }

            if (!vote.votes.has(votedUserId)) {
                vote.votes.set(votedUserId, 0);
            }

            vote.votes.set(votedUserId, vote.votes.get(votedUserId) + 1);
            vote.voters.push(interaction.user.id);

            await vote.save();

            await interaction.reply({ content: '✅ Your vote has been successfully recorded!', ephemeral: true });

        } catch (err) {
            console.error('VOTING BUTTON ERROR:', err);
        }
    }

    //--------------------------
    // DOTS BUTTON SYSTEM
    //--------------------------

    else if (interaction.isButton() && interaction.customId.startsWith('dots_')) {
        try {
            const votedId = interaction.customId.replace('dots_', '');

            const vote = await SeasonVote.findOne({
                messageId: interaction.message.id,
                type: 'dots',
                finished: false
            });

            if (!vote) return interaction.reply({ content: '❌ Active DOTS session not found.', ephemeral: true });
            if (Date.now() > vote.endTime) return interaction.reply({ content: '❌ Voting has ended.', ephemeral: true });
            if (!vote.participants.includes(votedId)) return interaction.reply({ content: '❌ Invalid candidate.', ephemeral: true });
            if (vote.voters.includes(interaction.user.id)) return interaction.reply({ content: '❌ You already voted!', ephemeral: true });

            vote.votes.set(votedId, (vote.votes.get(votedId) || 0) + 1);
            vote.voters.push(interaction.user.id);
            await vote.save();

            await interaction.reply({ content: `✅ Vote recorded for <@${votedId}>!`, ephemeral: true });

        } catch (err) {
            console.error('[DOTS BUTTON ERROR]', err);
        }
    }

    //--------------------------
    // TOTS BUTTON SYSTEM
    //--------------------------

    else if (interaction.isButton() && interaction.customId.startsWith('tots_')) {
        try {
            const safeKey = interaction.customId.replace('tots_', '');

            const vote = await SeasonVote.findOne({
                messageId: interaction.message.id,
                type: 'tots',
                finished: false
            });

            if (!vote) return interaction.reply({ content: '❌ Active TOTS session not found.', ephemeral: true });
            if (Date.now() > vote.endTime) return interaction.reply({ content: '❌ Voting has ended.', ephemeral: true });
            if (vote.voters.includes(interaction.user.id)) return interaction.reply({ content: '❌ You already voted!', ephemeral: true });

            // safeId eşleşmesini bul
            const matched = vote.participants.find(name =>
                name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) === safeKey
            );

            if (!matched) return interaction.reply({ content: '❌ Invalid team selection.', ephemeral: true });

            vote.votes.set(matched, (vote.votes.get(matched) || 0) + 1);
            vote.voters.push(interaction.user.id);
            await vote.save();

            await interaction.reply({ content: `✅ Vote recorded for **${matched}**!`, ephemeral: true });

        } catch (err) {
            console.error('[TOTS BUTTON ERROR]', err);
        }
    }

    //--------------------------
    // TEAMRADIO BUTTON SYSTEM
    //--------------------------

    else if (interaction.isButton() && interaction.customId.startsWith('radio_')) {
        const command = client.commands.get('teamradio');
        if (command && command.buttonHandler) {
            await command.buttonHandler(interaction);
        }
    }
});

//--------------------------
// PASSIVE MONITORING (HEARTBEAT)
//--------------------------
// This server keeps Railway active and allows external monitoring tools 
// (like UptimeRobot) to ping the bot and trigger webhooks if it crashes.

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Gofret System is Online and cooking 🧇');
    res.end();
}).listen(process.env.PORT || 3000, () => {
    console.log(`📡 Heartbeat server listening on port ${process.env.PORT || 3000}`);
});

//--------------------------
// LOGIN
//--------------------------

client.login(process.env.TOKEN);
