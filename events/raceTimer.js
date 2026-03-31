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
    '1475519196367421503'
];

const raceKeywords = [
    'off-season','host','room code','track','server',
    'sprint','laps','slipstream','white line','race mode'
];

//--------------------------------
// EXPORT
//--------------------------------
module.exports = (client) => {

    //--------------------------------
    // READY (TIMER RESTORE)
    //--------------------------------
    client.once('ready', async () => {

        const timers = await RaceTimer.find({ notified: false });

        for (const t of timers) {

            const remaining = t.endTime - Date.now();
            if (remaining <= 0) {
                await RaceTimer.deleteOne({ _id: t._id });
                continue;
            }

            setTimeout(async () => {
                try {
                    const fresh = await RaceTimer.findById(t._id);
                    if (!fresh || fresh.notified) return;

                    fresh.notified = true;
                    await fresh.save();

                    const channel = await client.channels.fetch(t.channelId).catch(() => null);
                    if (!channel) return;
                    const msg = await channel.messages.fetch(t.messageId).catch(() => null);
                    if (!msg) return;

                    for (let i = 0; i < 5; i++) {
                        await msg.reply(`🏁 ${msg.author} **RACE TIME!**`);
                        await new Promise(r => setTimeout(r, 1000));
                    }

                } catch (err) {
                    console.error('Timer restore error:', err);
                }
            }, remaining);
        }

        console.log(`✅ ${timers.length} timers restored`);
    });

    //--------------------------------
    // MESSAGE CREATE
    //--------------------------------
    client.on('messageCreate', async (message) => {

        if (message.author.bot) return;
        if (!allowedChannels.includes(message.channel.id)) return;

        //--------------------------------
        // SON 20 MESAJI ÇEK
        //--------------------------------
        const messages = await message.channel.messages.fetch({ limit: 20 }).catch(() => []);
        if (!messages) return;

        //--------------------------------
        // SON RACE MESAJINI BUL
        //--------------------------------
        const raceMsg = messages
            .filter(m => {
                const found = raceKeywords.filter(k => m.content.toLowerCase().includes(k));
                return found.length >= 5;
            })
            .sort((a,b) => b.createdTimestamp - a.createdTimestamp)
            .first();

        if (!raceMsg) return;

        //--------------------------------
        // DUPLICATE CHECK
        //--------------------------------
        const exists = await RaceTimer.findOne({ messageId: raceMsg.id });
        if (exists) return;

        //--------------------------------
        // TIME PARSE
        //--------------------------------
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

        //--------------------------------
        // END TIME
        //--------------------------------
        const endTime = raceMsg.createdTimestamp + totalMs;
        if (endTime <= Date.now()) return;

        //--------------------------------
        // DB SAVE
        //--------------------------------
        await RaceTimer.create({
            messageId: raceMsg.id,
            channelId: raceMsg.channel.id,
            guildId: raceMsg.guild.id,
            endTime
        });

        //--------------------------------
        // REACTION (FIXED)
        //--------------------------------
        try {
            await raceMsg.react('🏁');
        } catch {}

        //--------------------------------
        // TIMER
        //--------------------------------
        const delay = endTime - Date.now();

        setTimeout(async () => {
            try {
                const t = await RaceTimer.findOne({ messageId: raceMsg.id });
                if (!t || t.notified) return;

                t.notified = true;
                await t.save();

                for (let i = 0; i < 5; i++) {
                    await raceMsg.reply(`🏁 ${raceMsg.author} **RACE TIME!**`);
                    await new Promise(r => setTimeout(r, 1000));
                }

            } catch (err) {
                console.error('Timer execute error:', err);
            }
        }, delay);

    });

};