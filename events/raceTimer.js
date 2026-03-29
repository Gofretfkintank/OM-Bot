const RaceTimer = require('../models/RaceTimer');

const allowedChannels = [
    '1452925248973443072',    
    '1452925110037118986',
    '1453103992514019499',
    '1480929264693018734',
    '1475519196367421503'
];

const raceKeywords = [
    'off-season', 'host', 'room code', 'track', 'server', 
    'sprint', 'laps', 'slipstream', 'white line', 'race mode'
];

module.exports = (client) => {

    // 🔥 BOT AÇILINCA TIMERLARI GERİ YÜKLE
    client.once('ready', async () => {
        const timers = await RaceTimer.find();

        for (const t of timers) {
            const elapsed = Date.now() - new Date(t.startTime).getTime();
            const remaining = t.duration - elapsed;

            if (remaining <= 0) {
                await RaceTimer.deleteOne({ _id: t._id });
                continue;
            }

            setTimeout(async () => {
                try {
                    const channel = await client.channels.fetch(t.channelId);
                    const msg = await channel.messages.fetch(t.messageId);

                    for (let i = 0; i < 5; i++) {
                        await msg.reply(`🏁 <@${t.userId}> **RACE TIME!** GET TO THE TRACK NOW! 🏎️💨`);
                        await new Promise(res => setTimeout(res, 1000));
                    }

                    await RaceTimer.deleteOne({ _id: t._id });

                } catch (err) {
                    console.error(err);
                }
            }, remaining);
        }
    });

    client.on('messageCreate', async (message) => {

        if (message.author.bot) return;
        if (!allowedChannels.includes(message.channel.id)) return;

        const content = message.content.toLowerCase();

        const foundKeywords = raceKeywords.filter(word => content.includes(word));
        if (foundKeywords.length < 5) return;

        let totalMs = 0;

        const hourRegex = /(\d+)\s*(hours?|h|saat|sa)\b/g;
        const minRegex = /(\d+)\s*(minutes?|min|m|dakika|dk)\b/g;

        let match;
        while ((match = hourRegex.exec(content)) !== null) {
            totalMs += parseInt(match[1]) * 3600 * 1000;
        }

        while ((match = minRegex.exec(content)) !== null) {
            totalMs += parseInt(match[1]) * 60 * 1000;
        }

        if (totalMs <= 0) return;

        // emoji
        try {
            await message.react('1478771734831173662');
        } catch {}

        // 🔥 DB'YE KAYDET
        const timerData = await RaceTimer.create({
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild.id,
            userId: message.author.id,
            duration: totalMs,
            startTime: new Date()
        });

        // TIMER
        setTimeout(async () => {
            try {
                for (let i = 0; i < 5; i++) {
                    await message.reply(`🏁 ${message.author} **RACE TIME!** GET TO THE TRACK NOW! 🏎️💨`);
                    await new Promise(res => setTimeout(res, 1000));
                }

                await RaceTimer.deleteOne({ _id: timerData._id });

            } catch (err) {
                console.error(err);
            }
        }, totalMs);

    });
};