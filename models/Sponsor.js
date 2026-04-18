// models/Sponsor.js
// Pilot sponsorluk kayıtları
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const sponsorSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },

    // Aktif sponsorun ID'si (SPONSOR_CATALOG'daki id)
    activeSponsorId: { type: String, default: null },

    // Aktif sponsor başlangıç tarihi
    sponsorSince: { type: Date, default: null },

    // Kaç yarıştır bu sponsorla
    racesWithSponsor: { type: Number, default: 0 },

    // Toplam sponsordan kazanılan coin
    totalSponsorEarned: { type: Number, default: 0 },

    // Mevcut 3 teklifin ID listesi
    offers: { type: [String], default: [] },

    // Teklifler ne zaman oluşturuldu (yenileme için)
    offersGeneratedAt: { type: Date, default: null },

    // Kaç kez sponsor değiştirdi (geçmiş)
    sponsorHistory: { type: [String], default: [] }

}, { timestamps: true });

module.exports = mongoose.model('Sponsor', sponsorSchema);
