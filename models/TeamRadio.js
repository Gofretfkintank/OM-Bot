// models/TeamRadio.js
const mongoose = require('mongoose');

const teamRadioSchema = new mongoose.Schema({
    channelId:  { type: String, required: true, unique: true },
    messageId:  { type: String, default: null },   // panel mesajının ID'si
    teamName:   { type: String, required: true },
    openerTag:  { type: String, default: '' },      // kim açtı (display)
    openerId:   { type: String, default: '' },      // userId
    fiaVisible: { type: Boolean, default: false },  // FIA toggle durumu
    closed:     { type: Boolean, default: false },
    closedAt:   { type: Date, default: null },      // kapanma zamanı (restart safe)
}, { timestamps: true });

module.exports = mongoose.model('TeamRadio', teamRadioSchema);
