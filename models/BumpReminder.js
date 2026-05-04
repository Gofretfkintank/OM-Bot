//--------------------------------
// MODEL
//--------------------------------
const mongoose = require('mongoose');

const bumpReminderSchema = new mongoose.Schema({
    // 'carl' or 'disboard'
    type: { type: String, required: true },

    // For carl: the user who bumped (reminded individually)
    userId: { type: String, default: null },

    // Unix timestamp (ms) when the reminder should fire
    remindAt: { type: Number, required: true },

    // Whether the reminder has already fired
    notified: { type: Boolean, default: false }
});

module.exports = mongoose.model('BumpReminder', bumpReminderSchema);
