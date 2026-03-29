const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },

    races: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    podiums: { type: Number, default: 0 },
    poles: { type: Number, default: 0 },

    dnf: { type: Number, default: 0 },
    dns: { type: Number, default: 0 },

    wdc: { type: Number, default: 0 },
    wcc: { type: Number, default: 0 },

    doty: { type: Number, default: 0 },

    voters: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Driver', driverSchema);