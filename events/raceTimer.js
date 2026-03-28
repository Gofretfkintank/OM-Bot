// events/raceTimer.js

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
    client.on('messageCreate', async (message) => {

        console.log('\n====== YENİ MESAJ ======');
        console.log('Author:', message.author.tag);
        console.log('Channel:', message.channel.id);
        console.log('Content:', message.content);

        if (message.author.bot) {
            console.log('❌ Bot mesajı, skip');
            return;
        }

        if (!allowedChannels.includes(message.channel.id)) {
            console.log('❌ Kanal izinli değil');
            return;
        }

        console.log('✅ Kanal uygun');

        const content = message.content.toLowerCase();

        const foundKeywords = raceKeywords.filter(word => content.includes(word));

        console.log('🔍 Bulunan keywordler:', foundKeywords);
        console.log(`🔢 Keyword sayısı: ${foundKeywords.length}`);

        if (foundKeywords.length < 5) {
            console.log('❌ Yeterli keyword yok, işlem iptal');
            return;
        }

        console.log('✅ Keyword kontrol geçti');

        let totalMs = 0;

        const hourRegex = /(\d+)\s*(hours?|h|saat|sa)\b/g;
        const minRegex = /(\d+)\s*(minutes?|min|m|dakika|dk)\b/g;

        let hourMatch;
        while ((hourMatch = hourRegex.exec(content)) !== null) {
            const val = parseInt(hourMatch[1]);
            console.log(`⏱ Saat bulundu: ${val}`);
            totalMs += val * 3600 * 1000;
        }

        let minMatch;
        while ((minMatch = minRegex.exec(content)) !== null) {
            const val = parseInt(minMatch[1]);
            console.log(`⏱ Dakika bulundu: ${val}`);
            totalMs += val * 60 * 1000;
        }

        console.log(`⏱ Toplam süre(ms): ${totalMs}`);

        if (totalMs <= 0) {
            console.log('❌ Süre bulunamadı, iptal');
            return;
        }

        console.log(`✅ Timer kuruluyor: ${totalMs / 1000} saniye`);

        // ✅ SADECE CUSTOM EMOJI
        try {
            await message.react('1478771734831173662');
            console.log('✅ Custom emoji atıldı');
        } catch (err) {
            console.error('❌ REACT ERROR:', err);
        }

        // TIMER
        setTimeout(async () => {
            console.log('🏁 TIMER BİTTİ, mesaj gönderiliyor');

            try {
                for (let i = 0; i < 5; i++) {
                    await message.reply(`🏁 ${message.author} **RACE TIME!** GET TO THE TRACK NOW! 🏎️💨`);
                    console.log(`📢 Ping ${i + 1}`);
                    await new Promise(res => setTimeout(res, 1000));
                }
            } catch (err) {
                console.error('❌ TIMER ERROR:', err);
            }

        }, totalMs);

    });
};