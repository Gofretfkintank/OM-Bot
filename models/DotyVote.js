//--------------------------
// MODEL: DOTY VOTE
//--------------------------

const mongoose = require('mongoose');

const dotyVoteSchema = new mongoose.Schema({
    messageId: String,
    participants: [String], // userId listesi
    votes: {
        type: Map,
        of: Number,
        default: {}
    },
    voters: {
        type: [String], // kim oy verdi
        default: []
    },
    endTime: Number,
    finished: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('DotyVote', dotyVoteSchema);