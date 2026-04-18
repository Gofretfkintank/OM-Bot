// events/economyListener.js
// OM-Bot Economy Listener
// ─────────────────────────────────────────────────────────────────────────────
// BOTS_CHANNEL  → Madcardex / Ballsdex / F1dex catch mesajlarını dinler
//   Bot mesaj formatları:
//     Madcardex : "<@ID> You caught **ALFA ROMEO C41**! ..."
//     Ballsdex  : "<@ID> You caught **Argentina**! ..."
//     F1dex     : "<@ID> You signed **Nicholas Latifi**! ..."
//   → Direkt o kullanıcıya +COINS_PER_CATCH coin
//   → Anti-spam: aynı kullanıcı BOTS_COOLDOWN_MS içinde tekrar ödül alamaz
//
// LEVELS_CHANNEL → Arcane level-up mesajlarını dinler
//   Format: "<@ID> has reached lap **N**. Will he finish the race?"
//   → Her yeni lap için +COINS_PER_LEVEL coin
// ─────────────────────────────────────────────────────────────────────────────

const Economy = require('../models/Economy');

// ── Kanal ID'leri ──────────────────────────────────────────────────────────
const BOTS_CHANNEL_ID   = '1452733309724393664';
const LEVELS_CHANNEL_ID = '1452948024299884670';

// ── Ödül miktarları ────────────────────────────────────────────────────────
const COINS_PER_CATCH = 25;  // Madcardex / Ballsdex / F1dex catch
const COINS_PER_LEVEL = 50;  // Her yeni Arcane lap

// ── Anti-spam cooldown (ms) ────────────────────────────────────────────────
const BOTS_COOLDOWN_MS = 30_000; // 30 saniye

// ── Regex'ler ──────────────────────────────────────────────────────────────
// Madcardex / Ballsdex / F1dex
const CATCH_REGEX = /<@(\d+)> You (?:caught|signed) \*\*(.+?)\*\*/i;

// Arcane level-up
const ARCANE_REGEX = /<@(\d+)> has reached lap \*\*(\d+)\*\*/i;

// ─────────────────────────────────────────────────────────────────────────────

module.exports = function (client) {

    client.on('messageCreate', async (message) => {
        if (!message.guild) return;
        if (!message.author.bot) return; // Sadece bot mesajlarını dinle

        // ── LEVELS KANALI: Arcane level-up ──────────────────────────────────
        if (message.channel.id === LEVELS_CHANNEL_ID) {
            const match = message.content.match(ARCANE_REGEX);
            if (!match) return;

            const userId   = match[1];
            const newLevel = parseInt(match[2], 10);

            try {
                let wallet = await Economy.findOne({ userId });
                if (!wallet) wallet = new Economy({ userId });

                if (newLevel <= wallet.lastLevelRewarded) return;

                wallet.lastLevelRewarded = newLevel;
                wallet.level = newLevel;
                await wallet.addCoins(COINS_PER_LEVEL);

                await message.channel.send(
                    `🏎️ <@${userId}> reached lap **${newLevel}**! ` +
                    `**+${COINS_PER_LEVEL} 🪙** added to your wallet. ` +
                    `Balance: **${wallet.coins} 🪙**`
                );
            } catch (err) {
                console.error('[EconomyListener] Level reward error:', err);
            }
            return;
        }

        // ── BOTS KANALI: Catch / Sign tespiti ───────────────────────────────
        if (message.channel.id !== BOTS_CHANNEL_ID) return;

        const match = message.content.match(CATCH_REGEX);
        if (!match) return;

        const userId   = match[1];
        const itemName = match[2];

        try {
            let wallet = await Economy.findOne({ userId });
            if (!wallet) wallet = new Economy({ userId });

            // Anti-spam cooldown
            const now = Date.now();
            if (wallet.lastBotsReward && now - wallet.lastBotsReward.getTime() < BOTS_COOLDOWN_MS) return;

            wallet.correctAnswers += 1;
            wallet.lastBotsReward  = new Date();
            await wallet.addCoins(COINS_PER_CATCH);

            await message.channel.send(
                `🎴 <@${userId}> caught **${itemName}** and earned **+${COINS_PER_CATCH} 🪙**! ` +
                `Balance: **${wallet.coins} 🪙**`
            );
        } catch (err) {
            console.error('[EconomyListener] Catch reward error:', err);
        }
    });

};
