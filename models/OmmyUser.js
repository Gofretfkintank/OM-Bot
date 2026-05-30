const mongoose = require('mongoose');

const ommyUserSchema = new mongoose.Schema({
    userId:   { type: String, required: true, unique: true },
    username: { type: String, default: '' },

    persona:   { type: String, default: '' },
    expertise: { type: String, default: '' },
    tone:      { type: String, enum: ['formal', 'casual', 'hype', ''], default: '' },
    notes:     { type: String, default: '' },

    summary:          { type: String, default: '' },
    summaryUpdatedAt: { type: Date },

    messageCount: { type: Number, default: 0 },
    lastSeenAt:   { type: Date },

}, { timestamps: true });

ommyUserSchema.index({ userId: 1 });

module.exports = mongoose.model('OmmyUser', ommyUserSchema);
