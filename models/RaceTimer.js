const mongoose = require("mongoose");

const raceTimerSchema = new mongoose.Schema({
    messageId: String,
    channelId: String,
    guildId: String,
    userId: String,
    duration: Number,
    startTime: Date
});

module.exports = mongoose.model("RaceTimer", raceTimerSchema);