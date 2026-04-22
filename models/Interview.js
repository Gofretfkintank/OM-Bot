// models/Interview.js
// Post-race interview session tracking
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({

    // Unique ID per session (used as customId)
    sessionId: { type: String, required: true, unique: true },

    // Track name
    trackName: { type: String, required: true },

    // Selected driver
    userId: { type: String, required: true },

    // Session status
    // pending → button sent, waiting
    // done    → completed
    // fined   → timed out, fine issued
    status: {
        type:    String,
        enum:    ['pending', 'done', 'fined'],
        default: 'pending',
    },

    // 3 questions drawn from the pool
    questions: { type: [String], default: [] },

    // Driver's answers
    answers: { type: [String], default: [] },

    // Was the interview leaked?
    leaked: { type: Boolean, default: false },

    // Was profanity detected?
    flagged: { type: Boolean, default: false },

    // Message ID of the button message (for timeout cleanup)
    messageId: { type: String, default: null },

    // Channel ID where the interview was started
    channelId: { type: String, default: null },

    // Guild ID — needed to resolve guild when modal is submitted from a DM
    guildId: { type: String, default: null },

    // Expiry time (15 min after pending)
    expiresAt: { type: Date, default: null },

}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);
