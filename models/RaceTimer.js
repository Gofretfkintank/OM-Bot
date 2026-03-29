--------------------------
// MODEL
--------------------------
const mongoose = require('mongoose');

const raceTimerSchema = new mongoose.Schema({
    messageId: String,
    channelId: String,
    guildId: String,
    endTime: Number,
    notified: { type: Boolean, default: false }
});

module.exports = mongoose.model('RaceTimer', raceTimerSchema);