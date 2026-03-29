const mongoose = require('mongoose');

const jailSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    jailed: { type: Boolean, default: false }
});

module.exports = mongoose.model('Jail', jailSchema);