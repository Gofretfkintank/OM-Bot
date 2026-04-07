const mongoose = require('mongoose');

//--------------------------------
// Her bir adminin verdiği puanlar
//--------------------------------
const adminRatingSchema = new mongoose.Schema({
    adminId:     { type: String, required: true },
    adminTag:    { type: String },              // kim puanladı (display için)
    pace:        { type: Number, min: 0, max: 99, default: 50 },
    racecraft:   { type: Number, min: 0, max: 99, default: 50 },
    defending:   { type: Number, min: 0, max: 99, default: 50 },
    overtaking:  { type: Number, min: 0, max: 99, default: 50 },
    consistency: { type: Number, min: 0, max: 99, default: 50 },
    experience:  { type: Number, min: 0, max: 99, default: 50 },
    updatedAt:   { type: Date, default: Date.now }
}, { _id: false });

//--------------------------------
// Ana DriverRating şeması
//--------------------------------
const driverRatingSchema = new mongoose.Schema({
    userId:   { type: String, required: true, unique: true },
    username: { type: String, default: '' },    // Discord username cache

    // Her adminin ayrı puanları — max 1 entry per admin (upsert mantığı web'de)
    ratings: { type: [adminRatingSchema], default: [] },

    // Tüm adminlerin ortalaması — her save sonrası otomatik güncellenir
    avg: {
        pace:        { type: Number, default: 0 },
        racecraft:   { type: Number, default: 0 },
        defending:   { type: Number, default: 0 },
        overtaking:  { type: Number, default: 0 },
        consistency: { type: Number, default: 0 },
        experience:  { type: Number, default: 0 },
        overall:     { type: Number, default: 0 }
    },

    ratedBy: { type: Number, default: 0 }   // kaç admin puanladı

}, { timestamps: true });

//--------------------------------
// Ortalama hesaplama yardımcısı
// Web sitesinde her submit sonrası çağrılır
//--------------------------------
driverRatingSchema.methods.recalcAvg = function () {
    const r = this.ratings;
    if (r.length === 0) return;

    const fields = ['pace', 'racecraft', 'defending', 'overtaking', 'consistency', 'experience'];

    for (const field of fields) {
        const sum = r.reduce((acc, entry) => acc + (entry[field] ?? 50), 0);
        this.avg[field] = Math.round(sum / r.length);
    }

    // Ağırlıklı overall (toplam 100)
    this.avg.overall = Math.round(
        this.avg.pace        * 0.25 +
        this.avg.racecraft   * 0.20 +
        this.avg.defending   * 0.15 +
        this.avg.overtaking  * 0.15 +
        this.avg.consistency * 0.15 +
        this.avg.experience  * 0.10
    );

    this.ratedBy = r.length;
};

module.exports = mongoose.model('DriverRating', driverRatingSchema);
