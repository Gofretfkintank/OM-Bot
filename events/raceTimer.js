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

        // 1. ADIM: Mesajda kaç tane anahtar kelime geçtiğini say
        const foundKeywords = raceKeywords.filter(word => content.includes(word));
        
        // Eğer 5'ten az anahtar kelime varsa, bu resmi bir duyuru değildir; iptal et.
        if (foundKeywords.length < 5) return;

        // 2. ADIM: Zamanı hesapla
        let totalMs = 0;
        const hourRegex = /(\d+)\s*(hours?|h|saat|sa|houds?)\b/g; // "houds" typosu için de önlem aldım :)
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

        console.log(`[OFF-SEASON] ${message.author.tag} tarafından resmi yarış duyurusu algılandı. Süre: ${totalMs/1000}sn`);

        // Botun duyuruyu onayladığını belirtmek için bir kupa emojisi ekleyelim
        await message.react('<:niggerbird:1478771734831173662>').catch(() => {});

        setTimeout(async () => {
            try {
                // Yarış duyurusuna reply atarak hatırlat
                await message.reply(`🏁 **RACE ALERT!** The time is up! Get to the track! 🏎️💨`);
            } catch (err) {
                console.error('[RACE TIMER ERROR]', err);
            }
        }, totalMs);
    });
};
