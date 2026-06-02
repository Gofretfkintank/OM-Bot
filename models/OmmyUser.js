const mongoose = require('mongoose');

const ommyUserSchema = new mongoose.Schema({
    userId:   { type: String, required: true, unique: true },
    username: { type: String, default: '' },

    // Admin-set fields
    persona:   { type: String, default: '' },
    expertise: { type: String, default: '' },
    tone:      { type: String, enum: ['formal', 'casual', 'hype', ''], default: '' },
    notes:     { type: String, default: '' },

    // Auto-discovered nick (from channel scan or display name cleaning)
    preferredNick:   { type: String, default: '' },
    nickLastScanned: { type: Date },

    // Behavioral profile (auto-generated from server activity)
    behaviorSummary:    { type: String, default: '' },
    behaviorUpdatedAt:  { type: Date },

    // Conversation memory
    summary:          { type: String, default: '' },
    summaryUpdatedAt: { type: Date },

    messageCount: { type: Number, default: 0 },
    lastSeenAt:   { type: Date },

}, { timestamps: true });

ommyUserSchema.index({ userId: 1 });

module.exports = mongoose.model('OmmyUser', ommyUserSchema);
