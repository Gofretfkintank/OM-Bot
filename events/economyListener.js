// events/economyListener.js
// OM-Bot Economy Listener
// ─────────────────────────────────────────────────────────────────────────────
// İki kanalı dinler:
//   BOTS_CHANNEL   → Ballsdex / MadCardex / F1Dex gibi botların soru kanalı
//   LEVELS_CHANNEL → Arcane'in level-up mesajlarını attığı kanal
//
// Bots kanalı mantığı:
//   1) Bot soru sorar → collector başlatılır (sadece o kullanıcı için)
//   2) Kullanıcı doğru cevabı verir → +COINS_PER_CORRECT coin
//   3) Başka bir bot "doğru / correct / caught" içeren mesaj atarsa
//      → o anda aktif collector'ı kazanan olarak kapatır
//
// Arcane level mantığı:
//   Arcane şu formatta mesaj atar:
//   "<@USER_ID> has reached lap **N**. Will he finish the race?"
//   → Her yeni lap için COINS_PER_LEVEL coin ödülü
// ─────────────────────────────────────────────────────────────────────────────

const Economy = require('../models/Economy');

// ── Kanal ID'leri ──────────────────────────────────────────────────────────
const BOTS_CHANNEL_ID   = '1452733309724393664';
const LEVELS_CHANNEL_ID = '1452948024299884670';

// ── Ödül miktarları ────────────────────────────────────────────────────────
const COINS_PER_CORRECT = 25;   // Bots kanalında doğru cevap
const COINS_PER_LEVEL   = 50;   // Her yeni Arcane lap

// ── Anti-spam cooldown (ms) ────────────────────────────────────────────────
const BOTS_COOLDOWN_MS = 30_000; // 30 saniye

// ── Aktif soru takip haritası ──────────────────────────────────────────────
// key: userId  →  value: { timeout: Timeout, challengeBot: string }
const activeChallenges = new Map();

// ── Arcane mesaj regex ─────────────────────────────────────────────────────
// "<@1420869166654689330> has reached lap **9**. Will he finish the race?"
const ARCANE_LEVEL_REGEX = /<@(\d+)> has reached lap \*\*(\d+)\*\*/i;

// ── Bots kanalı: bot'un soru attığını tespit etmek için anahtar kelimeler ──
// Ballsdex, MadCardex, F1Dex gibi botlar genelde bir soru sorar.
// Bu kelimelerden biri varsa → o kanalı dinlemeye başla
const QUESTION_KEYWORDS = [
    'which', 'who', 'what', 'guess', 'identify',
    'hangi', 'kim', 'ne', 'tahmin', 'bul'
];

// ── Doğru cevap teyit kelimeleri (bot onayı) ───────────────────────────────
const CONFIRM_KEYWORDS = [
    'correct', 'doğru', 'caught', 'yakaladın', 'right',
    'winner', 'kazandı', 'kazanan', 'tebrik', 'congrats', 'bravo'
];

// ─────────────────────────────────────────────────────────────────────────────

module.exports = function (client) {

    client.on('messageCreate', async (message) => {
        if (!message.guild) return;

        // ── LEVELS KANALI: Arcane level-up ──────────────────────────────────
        if (message.channel.id === LEVELS_CHANNEL_ID) {
            // Arcane bir bot, bot mesajlarını da burada dinliyoruz (istisna)
            const match = message.content.match(ARCANE_LEVEL_REGEX);
            if (!match) return;

            const userId   = match[1];
            const newLevel = parseInt(match[2], 10);

            try {
                let wallet = await Economy.findOne({ userId });
                if (!wallet) wallet = new Economy({ userId });

                // Aynı level için tekrar ödül verme
                if (newLevel <= wallet.lastLevelRewarded) return;

                wallet.lastLevelRewarded = newLevel;
                wallet.level = newLevel;
                await wallet.addCoins(COINS_PER_LEVEL);

                // Tebrik mesajı
                await message.channel.send(
                    `🏎️ <@${userId}> lap **${newLevel}**'e ulaştı! ` +
                    `Hesabına **+${COINS_PER_LEVEL} 🪙** yatırıldı. ` +
                    `Toplam: **${wallet.coins} 🪙**`
                );
            } catch (err) {
                console.error('[EconomyListener] Level ödülü hatası:', err);
            }
            return;
        }

        // ── BOTS KANALI ─────────────────────────────────────────────────────
        if (message.channel.id !== BOTS_CHANNEL_ID) return;

        // Bot mu insan mı ayrımı
        const isBot   = message.author.bot;
        const userId  = message.author.id;
        const content = message.content.toLowerCase();

        // 1) Bot soru soruyor → collector başlat
        if (isBot) {
            const isQuestion = QUESTION_KEYWORDS.some(k => content.includes(k));
            if (!isQuestion) {

                // Doğru cevap teyidi mi?
                const isConfirm = CONFIRM_KEYWORDS.some(k => content.includes(k));
                if (isConfirm && activeChallenges.size > 0) {
                    // Mesajdaki @mention'ı bul (kazanan kullanıcı)
                    const mentionedId = message.mentions.users.first()?.id;
                    if (mentionedId && activeChallenges.has(mentionedId)) {
                        await rewardUser(mentionedId, message.channel);
                        clearChallenge(mentionedId);
                    }
                }
                return;
            }

            // Soru tespit edildi → channel-wide challenge başlat
            // activeChallenges'ı bu soru için "hazır" konuma getir
            // Gerçek kullanıcıyı ilk cevap verence kaydedeceğiz
            // 60 saniye timeout
            const timeout = setTimeout(() => {
                activeChallenges.delete('__pending__');
            }, 60_000);

            activeChallenges.set('__pending__', {
                timeout,
                botId: userId,
                channel: message.channel.id
            });

            return;
        }

        // 2) İnsan mesajı → aktif soru var mı?
        if (!activeChallenges.has('__pending__')) return;

        // Anti-spam cooldown kontrolü
        try {
            let wallet = await Economy.findOne({ userId });
            if (!wallet) wallet = new Economy({ userId });

            const now = Date.now();
            if (wallet.lastBotsReward && (now - wallet.lastBotsReward.getTime()) < BOTS_COOLDOWN_MS) {
                return; // Cooldown'da, ödül yok ama engelleme de yok
            }

            // Doğru cevabı kendimiz bilmiyoruz (bot bilir), o yüzden
            // şimdilik "ilk cevap veren" kazanır mantığı var.
            // Bot teyit ettikten sonra ödül verilir.
            // Kullanıcıyı "bekleme" haritasına al.
            const pending = activeChallenges.get('__pending__');
            clearTimeout(pending.timeout);

            // 10 saniye içinde bot teyit mesajı beklenir
            const timeout = setTimeout(() => {
                activeChallenges.delete(userId);
            }, 10_000);

            activeChallenges.set(userId, { timeout, wallet });
            activeChallenges.delete('__pending__');

        } catch (err) {
            console.error('[EconomyListener] Bots kullanıcı kayıt hatası:', err);
        }
    });

};

// ── Yardımcı: Kullanıcıya coin ver ─────────────────────────────────────────
async function rewardUser(userId, channel) {
    try {
        let wallet = await Economy.findOne({ userId });
        if (!wallet) wallet = new Economy({ userId });

        wallet.correctAnswers += 1;
        wallet.lastBotsReward  = new Date();
        await wallet.addCoins(COINS_PER_CORRECT);

        await channel.send(
            `✅ <@${userId}> doğru cevap verdi! ` +
            `**+${COINS_PER_CORRECT} 🪙** kazandı. ` +
            `Toplam: **${wallet.coins} 🪙**`
        );
    } catch (err) {
        console.error('[EconomyListener] Coin ödül hatası:', err);
    }
}

// ── Yardımcı: Challenge temizle ─────────────────────────────────────────────
function clearChallenge(userId) {
    const data = activeChallenges.get(userId);
    if (data?.timeout) clearTimeout(data.timeout);
    activeChallenges.delete(userId);
}
