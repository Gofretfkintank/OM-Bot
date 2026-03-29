const mongoose = require('mongoose');

const warnSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    warns: [
        {
            reason: String,
            moderator: String,
            date: String
        }
    ]
});

module.exports = mongoose.model('Warn', warnSchema);