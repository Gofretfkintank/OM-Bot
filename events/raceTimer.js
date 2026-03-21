// events/raceTimer.js
const allowedChannels = [
    '1452925248973443072',    
    '1452925110037118986',
    '1453103992514019499',
    '1480929264693018734'
];

// Botun tanımasını istediğimiz önemli kelimeler
const raceKeywords = [
    'off-season', 'host', 'room code', 'track', 'server', 
    'sprint', 'laps', 'slipstream', 'white line', 'race mode'
];

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!allowedChannels.includes(message.channel.id)) return;

        const content = message.content.toLowerCase();

        // 1. ADIM: Anahtar kelime kontrolü
        const foundKeywords = raceKeywords.filter(word => content.includes(word));
        if (foundKeywords.length < 5) return;

        // 2. ADIM: Zaman hesaplama
        let totalMs = 0;

        const hourRegex = /(\d+)\s*(hours?|h|saat|sa|houds?)\b/g;
        const minRegex = /(\d+)\s*(minutes?|min|m|dakika|dk|d)\b/g;

        let hourMatch;
        while ((hourMatch = hourRegex.exec(content)) !== null) {
            totalMs += parseInt(hourMatch[1]) * 3600 * 1000;
        }

        let minMatch;
        while ((minMatch = minRegex.exec(content)) !== null) {
            totalMs += parseInt(minMatch[1]) * 60 * 1000;
        }

        if (totalMs <= 0) return;

        console.log(`[OFF-SEASON] ${message.author.tag} yarış duyurusu algılandı. Süre: ${totalMs/1000}sn`);

        // Onay emojisi
        await message.react('<:niggerbird:1478771734831173662>').catch(() => {});

        // 3. ADIM: Timer + spam ping
        setTimeout(async () => {
            try {
                for (let i = 0; i < 5; i++) {
                    await message.reply(`🏁 ${message.author} **RACE TIME!** GET TO THE TRACK NOW! 🏎️💨`);
                    
                    // 1 saniye aralık (rate limit yememek için)
                    await new Promise(res => setTimeout(res, 1000));
                }
            } catch (err) {
                console.error('[RACE TIMER ERROR]', err);
            }
        }, totalMs);
    });
};