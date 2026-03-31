//--------------------------------
// IMPORTS
//--------------------------------
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

//--------------------------------
// DATABASE
//--------------------------------
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🟢 MongoDB connected"))
    .catch(err => console.error("Mongo Error:", err));

//--------------------------------
// MODELS
//--------------------------------
const Driver = require('./models/Driver');
const DotyVote = require('./models/DotyVote');

//--------------------------------
// CLIENT
//--------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

//--------------------------------
// CONFIG (Boss Protection)
//--------------------------------
const BOSS_ID = "1097807544849809408"; // 🔥 YOUR ACTUAL ID FIX
const CO_OWNER_ROLE_ID = "1447144645489328199";

const allowedGuilds = [
    process.env.GUILD_ID_1,
    process.env.GUILD_ID_2
].filter(Boolean);

//--------------------------------
// COMMAND LOADER
//--------------------------------
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
        const command = require(`./commands/${file}`);
        client.commands.set(command.data.name, command);
    }
}

//--------------------------------
// EVENT LOADER
//--------------------------------
const eventsPath = path.join(__dirname, 'events');

if (fs.existsSync(eventsPath)) {
    for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
        const event = require(`./events/${file}`);
        event(client);
        console.log(`📂 Event loaded: ${file}`);
    }
}

//--------------------------------
// READY
//--------------------------------
client.once('ready', async () => {
    console.log(`[ONLINE] ${client.user.tag}`);
    try {
        const data = client.commands.map(cmd => cmd.data.toJSON());
        for (const guildId of allowedGuilds) {
            await client.application.commands.set(data, guildId);
            console.log(`✅ Commands loaded: ${guildId}`);
        }
    } catch (err) {
        console.error("Setup error:", err);
    }

    // DOTY AUTO END LOOP
    setInterval(async () => {
        try {
            const votes = await DotyVote.find({ finished: false, endTime: { $lte: Date.now() } });
            for (const vote of votes) {
                try {
                    const channel = await client.channels.fetch(vote.channelId).catch(() => null);
                    if (!channel) continue;
                    const message = await channel.messages.fetch(vote.messageId).catch(() => null);
                    
                    let max = 0;
                    for (const v of vote.votes.values()) { if (v > max) max = v; }
                    const winners = [];
                    for (const [id, v] of vote.votes) { if (v === max && max > 0) winners.push(id); }

                    if (winners.length === 0) {
                        if (message) await message.reply('❌ No votes.');
                    } else if (winners.length > 1) {
                        if (message) await message.reply(`🤝 Tie:\n${winners.map(id => `<@${id}>`).join('\n')} (${max} votes)`);
                    } else {
                        const winner = winners[0];
                        await Driver.findOneAndUpdate({ userId: winner }, { $inc: { doty: 1 } }, { upsert: true });
                        if (message) await message.reply(`🏆 Winner: <@${winner}> with ${max} votes!`);
                    }
                    if (message) await message.edit({ components: [] }).catch(() => {});
                    vote.finished = true; await vote.save();
                } catch (err) { console.error('END ERROR:', err); }
            }
        } catch (err) { console.error('AUTO LOOP ERROR:', err); }
    }, 15000);
});

//--------------------------------
// INTERACTION HANDLER
//--------------------------------
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (!allowedGuilds.includes(interaction.guildId)) {
            return interaction.reply({ content: '❌ Not allowed.', ephemeral: true });
        }

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // 🔥 BOSS BYPASS: Immediate execution for your ID
        if (interaction.user.id === BOSS_ID) {
            try {
                await command.execute(interaction);
                return; 
            } catch (err) {
                console.error(`[BOSS ERROR]`, err);
                return interaction.reply({ content: '❌ Critical error in command.', ephemeral: true });
            }
        }

        // --- NORMAL PERMISSION LOGIC ---
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const isCoOwner = member.roles.cache.has(CO_OWNER_ROLE_ID);
            const hasFullPower = isCoOwner; 

            const modCommands = new Set(['mute', 'timeout', 'ban', 'kick', 'jail', 'unjail']);

            if (modCommands.has(interaction.commandName)) {
                const target = interaction.options.getMember('target') || interaction.options.getMember('user');
                if (target) {
                    if (target.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                        return interaction.reply({ content: '❌ Bot hierarchy limit.', ephemeral: true });
                    }
                    const targetIsStaff = target.permissions.has(PermissionsBitField.Flags.ManageMessages);
                    if (targetIsStaff && !hasFullPower) {
                        return interaction.reply({ content: '❌ Unauthorized against staff.', ephemeral: true });
                    }
                }
            }
            await command.execute(interaction);
        } catch (err) {
            console.error(`[EXECUTION ERROR]`, err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Command failed.', ephemeral: true }).catch(() => {});
            }
        }
    }

    // DOTY BUTTON SYSTEM
    else if (interaction.isButton() && interaction.customId.startsWith('doty_')) {
        try {
            const votedUserId = interaction.customId.split('_')[1];
            const updatedVote = await DotyVote.findOneAndUpdate(
                { messageId: interaction.message.id, finished: false, voters: { $ne: interaction.user.id }, participants: votedUserId },
                { $inc: { [`votes.${votedUserId}`]: 1 }, $push: { voters: interaction.user.id } },
                { new: true }
            );
            if (!updatedVote) return interaction.reply({ content: '❌ Already voted.', ephemeral: true });
            await interaction.reply({ content: '✅ Vote counted.', ephemeral: true });
        } catch (err) {
            console.error('VOTE ERROR:', err);
            await interaction.reply({ content: '❌ System error.', ephemeral: true }).catch(() => {});
        }
    }
});

//--------------------------------
// LOGIN
//--------------------------------
client.login(process.env.TOKEN);
