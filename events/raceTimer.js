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

        // Time satırını yakala
        const match = content.match(/time[:\s]*in (\d+)\s*hour/);
        const minMatch = content.match(/time[:\s]*in (\d+)\s*minute/);

        let msDelay = 0;
        if (match) msDelay += parseInt(match[1]) * 3600 * 1000;
        if (minMatch) msDelay += parseInt(minMatch[1]) * 60 * 1000;

        if (msDelay <= 0) return;

        console.log(`[RACE TIMER] ${message.author.tag} için ${msDelay/1000}s sonra ping ayarlandı.`);

        setTimeout(async () => {
            try {
                await message.channel.send(`Dingdong! ${message.author} yarış zamanı! 🏁`);
            } catch (err) {
                console.error('[RACE TIMER ERROR]', err);
            }
        }, msDelay);
    });
};