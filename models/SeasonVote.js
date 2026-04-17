const mongoose = require('mongoose');

const seasonVoteSchema = new mongoose.Schema({

    type: {
        type: String,
        enum: ['dots', 'tots'],
        required: true
    },

    messageId: String,
    channelId: String,
    guildId: String,

    // DOTS: Discord user ID'leri | TOTS: takım isimleri
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

module.exports = mongoose.model('SeasonVote', seasonVoteSchema);
