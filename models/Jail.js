const mongoose = require('mongoose');

const jailSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    roles: [String] // 🔥 eski roller burada tutuluyor
});

module.exports = mongoose.model('Jail', jailSchema);