/**
 * Message Model
 * Messages are also cleaned up when the room is deleted.
 * A cleanup job in roomService handles orphan messages.
 */
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  username:  { type: String, required: true },
  room:      { type: String, required: true },
  message:   { type: String, required: true, maxlength: 2000 },
  timestamp: { type: Date, default: Date.now }
});

MessageSchema.index({ room: 1, timestamp: 1 });

module.exports = mongoose.model('Message', MessageSchema);
