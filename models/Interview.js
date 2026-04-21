// models/Interview.js
// Post-race interview session tracking
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({

    // Her session için unique ID (customId olarak kullanılır)
    sessionId: { type: String, required: true, unique: true },

    // Hangi track için
    trackName: { type: String, required: true },

    // Seçilen pilot
    userId: { type: String, required: true },

    // Oturum durumu
    // pending → buton gönderildi, bekleniyor
    // done    → tamamlandı
    // fined   → timeout oldu, ceza verildi
    status: {
        type: String,
        enum: ['pending', 'done', 'fined'],
        default: 'pending'
    },

    // Sorulan 3 soru (havuzdan random çekilmiş)
    questions: { type: [String], default: [] },

    // Pilotun verdiği yanıtlar
    answers: { type: [String], default: [] },

    // Yanıt sızdı mı?
    leaked: { type: Boolean, default: false },

    // Argo tespit edildi mi?
    flagged: { type: Boolean, default: false },

    // Message ID (butonlu mesaj — timeout için)
    messageId: { type: String, default: null },

    // Kanal ID'si
    channelId: { type: String, default: null },

    // Timeout tarihi (pending'dan 15 dk sonra)
    expiresAt: { type: Date, default: null },

}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);
