const mongoose = require('mongoose');

// Stores bypass mute role-strip jobs so they survive Railway restarts.
// When Ommy strips admin roles to mute a privileged member, it writes
// a document here instead of using setTimeout. The restore loop in
// index.js polls every 30s and re-grants roles once restoreAt passes.

const PendingRoleRestoreSchema = new mongoose.Schema({
    userId:    { type: String, required: true },
    guildId:   { type: String, required: true },
    roleIds:   [{ type: String }],
    restoreAt: { type: Date,   required: true },
}, { timestamps: true });

module.exports = mongoose.model('PendingRoleRestore', PendingRoleRestoreSchema);
