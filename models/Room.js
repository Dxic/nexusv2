/**
 * Room Model
 * - Stores room metadata: name, hashed password, last activity
 * - Auto-delete trigger: if lastActivity > 24h and memberCount = 0
 */
const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name:         { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdBy:    { type: String, required: true },         // username who created
  lastActivity: { type: Date, default: Date.now },        // updated on every message
  memberCount:  { type: Number, default: 0 },             // live counter
  expiresAt:    { type: Date }                            // set when room empties
});

// TTL index: MongoDB auto-deletes the document when expiresAt is reached
// (MongoDB checks every ~60 seconds)
RoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Room', RoomSchema);
