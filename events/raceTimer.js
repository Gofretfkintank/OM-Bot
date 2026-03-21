// events/raceTimer.js
const allowedChannels = [
    '1452925248973443072',    
    '1452925110037118986',
    '1453103992514019499',
    '1480929264693018734'
];

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!allowedChannels.includes(message.channel.id)) return;

        const content = message.content.toLowerCase();

        // Trigger words: message must include "time" or "zaman"
        if (!content.includes('time') && !content.includes('zaman')) return;

        let totalMs = 0;

        // --- HOURS (matches: 1 hour, 2 hours, 1h, 1 sa, 1 saat) ---
        const hourRegex = /(\d+)\s*(hours?|h|saat|sa)\b/g;
        let hourMatch;
        while ((hourMatch = hourRegex.exec(content)) !== null) {
            totalMs += parseInt(hourMatch[1]) * 3600 * 1000;
        }

        // --- MINUTES (matches: 1 minute, 10 minutes, 10m, 10min, 10 dk, 10 dakika) ---
        const minRegex = /(\d+)\s*(minutes?|min|m|dakika|dk|d)\b/g;
        let minMatch;
        while ((minMatch = minRegex.exec(content)) !== null) {
            totalMs += parseInt(minMatch[1]) * 60 * 1000;
        }

        // If no valid time found, stop
        if (totalMs <= 0) return;

        // Safety limit: Max 24 hours
        if (totalMs > 24 * 3600 * 1000) {
            return message.reply("Whoops! You can't set a timer for more than 24 hours. 😅");
        }

        console.log(`[RACE TIMER] Set for ${message.author.tag}: ${totalMs / 1000} seconds.`);

        // React with a clock to show the bot is tracking
        await message.react('⏱️').catch(() => {});

        setTimeout(async () => {
            try {
                // Final alert in English
                await message.reply(`Ding-dong! ${message.author}, it's race time! 🏁`);
            } catch (err) {
                console.error('[RACE TIMER ERROR]', err);
            }
        }, totalMs);
    });
};
