const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    // Tek bir döküman — _id sabit 'singleton'
    _id: { type: String, default: 'singleton' },

    // Bakım modu açık mı?
    active: { type: Boolean, default: false },

    // Bakım başlatıldığında kaydedilen komut snapshot'ı
    // { commandName: hash }
    snapshot: { type: Map, of: String, default: {} },

    // Bakım modundayken değiştiği/eklendiği tespit edilen komutlar
    lockedCommands: { type: [String], default: [] },

    // Bakımı kim başlattı
    startedBy: { type: String, default: null },
    startedAt: { type: Date, default: null },

}, { _id: false });

module.exports = mongoose.model('Maintenance', maintenanceSchema);
