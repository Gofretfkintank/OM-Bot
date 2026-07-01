const mongoose = require('mongoose');

// One document per guild — general-purpose per-server bot settings.
// Currently just logging, but built to grow (e.g. welcome channel, etc.)
// without needing a new collection each time.
const guildConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    logChannelId: {
        type: String,
        default: null
    }
});

module.exports = mongoose.model('GuildConfig', guildConfigSchema);
