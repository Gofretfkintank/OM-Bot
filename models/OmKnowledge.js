// models/OmKnowledge.js
// Knowledge base for Ommy active learning — stores facts extracted from Discord channels

const { Schema, model } = require('mongoose');

const sourceSchema = new Schema({
    channelId:      { type: String },
    channelName:    { type: String },
    messageSnippet: { type: String },
}, { _id: false });

const knowledgeSchema = new Schema({
    guildId:    { type: String, required: true },
    category:   { type: String, required: true }, // registration, race_format, rules, schedule, roles, channels, economy, general
    key:        { type: String, required: true },  // unique within guild, e.g. "how_to_register"
    fact:       { type: String, required: true },  // the actual learned knowledge (natural language)
    confidence: { type: Number, default: 0.7 },    // 0–1, higher = more reliable
    sources:    { type: [sourceSchema], default: [] },
    active:     { type: Boolean, default: true },
}, { timestamps: true });

knowledgeSchema.index({ guildId: 1, active: 1 });
knowledgeSchema.index({ guildId: 1, key: 1 }, { unique: true });

module.exports = model('OmKnowledge', knowledgeSchema);
