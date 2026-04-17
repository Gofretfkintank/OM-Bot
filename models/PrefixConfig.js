const mongoose = require('mongoose');

const prefixConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    prefix: {
        type: String,
        default: 'om!'
    }
});

module.exports = mongoose.model('PrefixConfig', prefixConfigSchema);
