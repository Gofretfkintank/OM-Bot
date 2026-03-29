const mongoose = require('mongoose');

const dotyVoteSchema = new mongoose.Schema({

    messageId: String,
    channelId: String,
    guildId: String,

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

});

module.exports = mongoose.model('DotyVote', dotyVoteSchema);