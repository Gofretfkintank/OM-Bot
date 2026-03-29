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

    // 🔁 BOT AÇILINCA TIMERLARI GERİ YÜKLE
    client.once('ready', async () => {
        console.log('⏱ RaceTimer sistemi yükleniyor...');

        const timers = await RaceTimer.find({ notified: false });

        for (const timer of timers) {
            const remaining = timer.endTime - Date.now();

            if (remaining <= 0) {
                await RaceTimer.deleteOne({ _id: timer._id });
                continue;
            }

            setTimeout(async () => {
                try {
                    const channel = await client.channels.fetch(timer.channelId);
                    const msg = await channel.messages.fetch(timer.messageId);

                    for (let i = 0; i < 5; i++) {
                        await msg.reply(`🏁 ${msg.author} **RACE TIME!** GET TO THE TRACK NOW! 🏎️💨`);
                        await new Promise(res => setTimeout(res, 1000));
                    }

                    await RaceTimer.updateOne(
                        { _id: timer._id },
                        { notified: true }
                    );

                } catch (err) {
                    console.error('❌ TIMER LOAD ERROR:', err);
                }
            }, remaining);
        }
    });

    // 📩 YENİ MESAJ GELİNCE
    client.on('messageCreate', async (message) => {

        if (message.author.bot) return;
        if (!allowedChannels.includes(message.channel.id)) return;

        // 🔍 SON 20 MESAJI ÇEK
        const messages = await message.channel.messages.fetch({ limit: 20 });

        // 🎯 KEYWORD UYAN MESAJLARI BUL
        const raceMessages = messages
            .filter(msg => {
                const content = msg.content.toLowerCase();
                const found = raceKeywords.filter(word => content.includes(word));
                return found.length >= 5;
            })
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

        const raceMsg = raceMessages.first();

        if (!raceMsg) return;

        // ⏱ SÜRE PARSE
        const content = raceMsg.content.toLowerCase();

        let totalMs = 0;

        const hourRegex = /(\d+)\s*(hours?|h|saat|sa)/g;
        const minRegex = /(\d+)\s*(minutes?|min|m|dakika|dk)/g;

        let match;

        while ((match = hourRegex.exec(content)) !== null) {
            totalMs += parseInt(match[1]) * 3600000;
        }

        while ((match = minRegex.exec(content)) !== null) {
            totalMs += parseInt(match[1]) * 60000;
        }

        if (totalMs <= 0) return;

        const endTime = raceMsg.createdTimestamp + totalMs;

        // ⛔ ESKİYSE İPTAL
        if (endTime <= Date.now()) return;

        // 🔁 DB CHECK (aynı mesaj tekrar işlenmesin)
        const exists = await RaceTimer.findOne({
            messageId: raceMsg.id
        });

        if (exists) return;

        // ✅ EMOJI
        try {
            await raceMsg.react('1478771734831173662');
        } catch {}

        // 💾 DB KAYDET
        await RaceTimer.create({
            messageId: raceMsg.id,
            channelId: raceMsg.channel.id,
            guildId: raceMsg.guild.id,
            endTime
        });

        // ⏳ TIMER KUR
        const remaining = endTime - Date.now();

        setTimeout(async () => {
            try {
                for (let i = 0; i < 5; i++) {
                    await raceMsg.reply(`🏁 ${raceMsg.author} **RACE TIME!** GET TO THE TRACK NOW! 🏎️💨`);
                    await new Promise(res => setTimeout(res, 1000));
                }

                await RaceTimer.updateOne(
                    { messageId: raceMsg.id },
                    { notified: true }
                );

            } catch (err) {
                console.error('❌ TIMER ERROR:', err);
            }
        }, remaining);

    });
};