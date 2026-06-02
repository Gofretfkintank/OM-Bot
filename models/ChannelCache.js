const mongoose = require('mongoose');

const channelCacheSchema = new mongoose.Schema({
    channelId:      { type: String, required: true, unique: true },
    channelName:    { type: String, default: '' },
    guildId:        { type: String, default: '' },
    categoryId:     { type: String, default: '' },
    categoryName:   { type: String, default: '' },

    // Gemini-generated: what is this channel for + what's being discussed
    purpose:        { type: String, default: '' },
    contentSummary: { type: String, default: '' },

    // Raw recent messages (JSON string, last 50)
    rawMessages:    { type: String, default: '[]' },

    cachedAt:       { type: Date, required: true },
}, { timestamps: true });

channelCacheSchema.index({ channelId: 1 });
channelCacheSchema.index({ guildId: 1, categoryId: 1 });

module.exports = mongoose.model('ChannelCache', channelCacheSchema);
