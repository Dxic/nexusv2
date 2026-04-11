/**
 * UsedUsername Model
 * Every generated username is stored here permanently.
 * Before assigning a new username, server checks this collection
 * to guarantee global uniqueness — no two users ever share an identity.
 */
const mongoose = require('mongoose');

const UsedUsernameSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UsedUsername', UsedUsernameSchema);
