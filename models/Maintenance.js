const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    // Single document — _id is fixed as 'singleton'
    _id: { type: String, default: 'singleton' },

    // Is maintenance mode active?
    active: { type: Boolean, default: false },

    // Command snapshot saved when maintenance starts
    // { commandName: hash }
    snapshot: { type: Map, of: String, default: {} },

    // Commands detected as changed/added during maintenance
    lockedCommands: { type: [String], default: [] },

    // Who started maintenance
    startedBy: { type: String, default: null },
    startedAt: { type: Date, default: null },

    // Optional estimated duration (in minutes, null if not set)
    estimatedMinutes: { type: Number, default: null },

}, { _id: false });

module.exports = mongoose.model('Maintenance', maintenanceSchema);
