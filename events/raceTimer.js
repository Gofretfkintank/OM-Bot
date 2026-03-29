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

// ----------------------
// TIME PARSE FUNCTION
// ----------------------
function parseTime(content) {
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

    return totalMs;
}

// ----------------------
// TIMER START
// ----------------------
async function startTimer(message, delay) {
    try {
        await message.react('1478771734831173662');
    } catch {}

    setTimeout(async () => {
        try {
            for (let i = 0; i < 5; i++) {
                await message.reply(`🏁 ${message.author} **RACE TIME!** GET TO THE TRACK NOW! 🏎️💨`);
                await new Promise(res => setTimeout(res, 1000));
            }
        } catch (err) {
            console.error('TIMER ERROR:', err);
        }
    }, delay);
}

// ----------------------
// KEYWORD CHECK
// ----------------------
function hasEnoughKeywords(content) {
    const found = raceKeywords.filter(word => content.includes(word));
    return found.length >= 5;
}

// ----------------------
// EXPORT
// ----------------------
module.exports = (client) => {

    // ----------------------
    // LIVE MESSAGE LISTENER
    // ----------------------
    client.on('messageCreate', async (message) => {

        if (message.author.bot) return;
        if (!allowedChannels.includes(message.channel.id)) return;

        const content = message.content.toLowerCase();

        if (!hasEnoughKeywords(content)) return;

        const totalMs = parseTime(content);
        if (totalMs <= 0) return;

        startTimer(message, totalMs);
    });

    // ----------------------
    // READY (RECOVERY SYSTEM)
    // ----------------------
    client.once('ready', async () => {

        console.log('🔁 Recovering active race timers...');

        for (const channelId of allowedChannels) {

            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) continue;

            // 🔥 50 mesaj çek
            const messages = await channel.messages.fetch({ limit: 50 });

            // 🔥 keyword filtre
            const raceMessages = [];

            for (const msg of messages.values()) {

                if (msg.author.bot) continue;

                const content = msg.content.toLowerCase();

                if (hasEnoughKeywords(content)) {
                    raceMessages.push(msg);
                }
            }

            // 🔥 sadece son 5 geçerli race mesajı
            const lastRaceMessages = raceMessages
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
                .slice(0, 5);

            for (const msg of lastRaceMessages) {

                const content = msg.content.toLowerCase();
                const totalMs = parseTime(content);

                if (totalMs <= 0) continue;

                const endTime = msg.createdTimestamp + totalMs;
                const now = Date.now();

                if (endTime <= now) {
                    console.log('⏭ Expired timer skipped');
                    continue;
                }

                const remaining = endTime - now;

                console.log(`✅ Recovered timer: ${remaining / 1000}s`);

                startTimer(msg, remaining);
            }
        }
    });
};