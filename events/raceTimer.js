//--------------------------------
// IMPORTS
//--------------------------------
const RaceTimer = require('../models/RaceTimer');

//--------------------------------
// CONFIG
//--------------------------------
const allowedChannels = [
    '1452925248973443072',
    '1452925110037118986',
    '1453103992514019499',
    '1480929264693018734',
    '1475519196367421503',
    '1496136966067060777'
];

const raceKeywords = [
    'off-season','host','room code','track','server',
    'sprint','laps','slipstream','white line','race mode'
];

//--------------------------------
// GLOBAL TIMER MAP
// Key: timer._id.toString()
// Value: setTimeout handle
// Exported so race-delay.js can clearTimeout + reschedule
//--------------------------------
const timerMap = new Map();
module.exports.timerMap = timerMap;

//--------------------------------
// FIRE HELPER — marks notified, sends race-time replies
//--------------------------------
async function fireTimer(client, timerId, channelId, messageId) {
    timerMap.delete(timerId);

    const fresh = await RaceTimer.findById(timerId).catch(() => null);
    if (!fresh || fresh.notified) return;

    fresh.notified = true;
    await fresh.save();

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return;

    for (let i = 0; i < 5; i++) {
        await msg.reply(`🏁 ${msg.author} **RACE TIME!**`).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
    }
}

//--------------------------------
// SCHEDULE HELPER — (re)schedules a timer, clears previous if any
//--------------------------------
function scheduleTimer(client, timer) {
    const id = timer._id.toString();
    const remaining = timer.endTime - Date.now();

    // Clear existing handle if rescheduling (delay case)
    if (timerMap.has(id)) {
        clearTimeout(timerMap.get(id));
        timerMap.delete(id);
    }

    if (remaining <= 0) return; // already past, skip

    const handle = setTimeout(
        () => fireTimer(client, id, timer.channelId, timer.messageId),
        remaining
    );
    timerMap.set(id, handle);
}
module.exports.scheduleTimer = scheduleTimer;

//--------------------------------
// EXPORT (main event hook)
//--------------------------------
module.exports = (client) => {

    //--------------------------------
    // READY — restore timers from DB
    //--------------------------------
    client.once('ready', async () => {
        const timers = await RaceTimer.find({ notified: false });

        for (const t of timers) {
            const remaining = t.endTime - Date.now();
            if (remaining <= 0) {
                await RaceTimer.deleteOne({ _id: t._id });
                continue;
            }
            scheduleTimer(client, t);
        }

        console.log(`✅ ${timers.length} race timer(s) restored`);
    });

    //--------------------------------
    // MESSAGE CREATE — auto-detect race messages
    //--------------------------------
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!allowedChannels.includes(message.channel.id)) return;

        // Fetch last 20 messages to find the race announcement
        const messages = await message.channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (!messages) return;

        const raceMsg = messages
            .filter(m => {
                const found = raceKeywords.filter(k => m.content.toLowerCase().includes(k));
                return found.length >= 5;
            })
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
            .first();

        if (!raceMsg) return;

        // Duplicate check
        const exists = await RaceTimer.findOne({ messageId: raceMsg.id });
        if (exists) return;

        // Parse time from message content
        let totalMs = 0;
        const hourRegex = /(\d+)\s*(h|hour|saat)/g;
        const minRegex  = /(\d+)\s*(m|min|dk|dakika)/g;
        let match;

        while ((match = hourRegex.exec(raceMsg.content)) !== null) totalMs += parseInt(match[1]) * 3600000;
        while ((match = minRegex.exec(raceMsg.content))  !== null) totalMs += parseInt(match[1]) * 60000;
        if (totalMs <= 0) return;

        const endTime = raceMsg.createdTimestamp + totalMs;
        if (endTime <= Date.now()) return;

        // Save to DB
        const timer = await RaceTimer.create({
            messageId: raceMsg.id,
            channelId: raceMsg.channel.id,
            guildId:   raceMsg.guild.id,
            endTime
        });

        // React to acknowledge
        try { await raceMsg.react('🏁'); } catch {}

        // Schedule
        scheduleTimer(client, timer);
    });
};
