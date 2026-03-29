//--------------------------
// DOTY VOTE MODEL
//--------------------------

const mongoose = require('mongoose');

const dotyVoteSchema = new mongoose.Schema({
    messageId: String,
    channelId: String,
    participants: [String],

    votes: {
        type: Map,
        of: Number,
        default: {}
    },

    voters: {
        type: [String],
        default: []
    },

    endTime: Number,
    finished: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

module.exports = mongoose.model('DotyVote', dotyVoteSchema);