const mongoose = require('mongoose');

const economySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },

    // Para birimi
    coins: { type: Number, default: 0 },

    // Arcane level (kanaldan çekilen son bilinen level)
    level: { type: Number, default: 0 },

    // Bots kanalından doğru cevap verme sayısı
    correctAnswers: { type: Number, default: 0 },

    // Toplam kazanılan coin geçmişi (liderboard için)
    totalEarned: { type: Number, default: 0 },

    // Son level ödülü alınan level (tekrar ödülü önlemek için)
    lastLevelRewarded: { type: Number, default: 0 },

    // Anti-spam: son bots kanalı ödülü
    lastBotsReward: { type: Date, default: null },

    // Shop: satın alınan ürünlerin ID listesi
    inventory: { type: [String], default: [] },

    // Race Boost: bir sonraki yarışta +%50 coin (tek kullanım)
    raceBoost: { type: Boolean, default: false }

}, { timestamps: true });

// Coin ekle
economySchema.methods.addCoins = async function (amount) {
    this.coins += amount;
    this.totalEarned += amount;
    await this.save();
};

// Coin düş (0'ın altına inmez)
economySchema.methods.removeCoins = async function (amount) {
    this.coins = Math.max(0, this.coins - amount);
    await this.save();
};

module.exports = mongoose.model('Economy', economySchema);
