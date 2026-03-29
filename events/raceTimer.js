--------------------------
// IMPORTS
--------------------------
const RaceTimer = require('../models/RaceTimer');

--------------------------
// CONFIG
--------------------------
const allowedChannels = [
    '1452925248973443072',
    '1452925110037118986',
    '1453103992514019499',
    '1480929264693018734',
    '1475519196367421503'
];

const raceKeywords = [
    'off-season','host','room code','track','server',
    'sprint','laps','slipstream','white line','race mode'
];

--------------------------
// EXPORT
--------------------------
module.exports = (client) => {

    --------------------------
    // READY (RECOVERY)
    --------------------------
    client.once('ready', async () => {

        const timers = await RaceTimer.find({ notified: false });

        for (const t of timers) {

            const remaining = t.endTime - Date.now();

            if (remaining <= 0) {
                await RaceTimer.deleteOne({ _id: t._id });
                continue;
            }

            setTimeout(async () => {

                const fresh = await RaceTimer.findById(t._id);
                if (!fresh || fresh.notified) return;

                fresh.notified = true;
                await fresh.save();

                try {
                    const channel = await client.channels.fetch(t.channelId);
                    const msg = await channel.messages.fetch(t.messageId);

                    for (let i = 0; i < 5; i++) {
                        await msg.reply(`🏁 ${msg.author} **RACE TIME!**`);
                        await new Promise(r => setTimeout(r, 1000));
                    }

                } catch {}

            }, remaining);
        }

        console.log(`✅ ${timers.length} timer restore edildi`);
    });

    --------------------------
    // MESSAGE CREATE
    --------------------------
    client.on('messageCreate', async (message) => {

        if (message.author.bot) return;
        if (!allowedChannels.includes(message.channel.id)) return;

        const messages = await message.channel.messages.fetch({ limit: 20 });

        const raceMsg = messages
            .filter(m => {
                const found = raceKeywords.filter(k => m.content.toLowerCase().includes(k));
                return found.length >= 5;
            })
            .sort((a,b) => b.createdTimestamp - a.createdTimestamp)
            .first();

        if (!raceMsg) return;

        const exists = await RaceTimer.findOne({ messageId: raceMsg.id });
        if (exists) return;

        --------------------------
        // TIME PARSE
        --------------------------
        let totalMs = 0;

        const hourRegex = /(\d+)\s*(h|hour|saat)/g;
        const minRegex = /(\d+)\s*(m|min|dk|dakika)/g;

        let match;

        while ((match = hourRegex.exec(raceMsg.content)) !== null) {
            totalMs += parseInt(match[1]) * 3600000;
        }

        while ((match = minRegex.exec(raceMsg.content)) !== null) {
            totalMs += parseInt(match[1]) * 60000;
        }

        if (totalMs <= 0) return;

        const endTime = raceMsg.createdTimestamp + totalMs;

        if (endTime <= Date.now()) return;

        await RaceTimer.create({
            messageId: raceMsg.id,
            channelId: raceMsg.channel.id,
            guildId: raceMsg.guild.id,
            endTime
        });

        try { await raceMsg.react('1478771734831173662'); } catch {}

        const delay = endTime - Date.now();

        setTimeout(async () => {

            const t = await RaceTimer.findOne({ messageId: raceMsg.id });
            if (!t || t.notified) return;

            t.notified = true;
            await t.save();

            for (let i = 0; i < 5; i++) {
                await raceMsg.reply(`🏁 ${raceMsg.author} **RACE TIME!**`);
                await new Promise(r => setTimeout(r, 1000));
            }

        }, delay);

    });

};