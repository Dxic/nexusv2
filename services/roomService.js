/**
 * Room Service — Business Logic
 * Handles: create room, verify password, member tracking, expiry scheduling
 *
 * Expiry logic:
 *  - When last member leaves → set expiresAt = now + 24h
 *  - MongoDB TTL index auto-deletes the Room document after expiresAt
 *  - A cleanup job also deletes orphan messages for that room
 *  - When a new member joins → clear expiresAt (room is alive again)
 */
const bcrypt  = require('bcryptjs');
const Room    = require('../models/Room');
const Message = require('../models/Message');

const EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a new password-protected room.
 * Returns the room doc or throws if name is taken.
 */
async function createRoom(name, password, createdBy) {
  const existing = await Room.findOne({ name });
  if (existing) throw new Error('ROOM_EXISTS');

  const passwordHash = await bcrypt.hash(password, 10);
  const room = await Room.create({ name, passwordHash, createdBy, memberCount: 0 });
  return room;
}

/**
 * Verify password and return room, or throw descriptive errors.
 */
async function joinRoom(name, password) {
  const room = await Room.findOne({ name });
  if (!room) throw new Error('ROOM_NOT_FOUND');

  const valid = await bcrypt.compare(password, room.passwordHash);
  if (!valid) throw new Error('WRONG_PASSWORD');

  return room;
}

/**
 * Called when a user enters a room socket.
 * Increments memberCount and clears any pending expiry.
 */
async function onMemberJoin(roomName) {
  await Room.updateOne(
    { name: roomName },
    { $inc: { memberCount: 1 }, $unset: { expiresAt: '' }, lastActivity: new Date() }
  );
}

/**
 * Called when a user leaves a room socket.
 * Decrements memberCount. If 0 → schedule deletion in 24h.
 */
async function onMemberLeave(roomName) {
  const room = await Room.findOne({ name: roomName });
  if (!room) return;

  const newCount = Math.max(0, room.memberCount - 1);
  const update = { memberCount: newCount };

  if (newCount === 0) {
    update.expiresAt = new Date(Date.now() + EXPIRE_MS);
  }

  await Room.updateOne({ name: roomName }, update);
}

/**
 * Touch lastActivity on every message (resets the 24h clock).
 * Note: expiresAt is only set when the room is EMPTY, so this only
 * matters for informational purposes / future extensions.
 */
async function touchActivity(roomName) {
  await Room.updateOne({ name: roomName }, { lastActivity: new Date() });
}

/**
 * Cleanup orphan messages for a deleted room.
 * Called by a periodic job in server.js.
 */
async function cleanupOrphanMessages() {
  const rooms    = await Room.find({}, 'name').lean();
  const names    = rooms.map(r => r.name);
  const result   = await Message.deleteMany({ room: { $nin: names } });
  return result.deletedCount;
}

/**
 * Get basic room info (without password hash) for display.
 */
async function getRoomInfo(name) {
  return Room.findOne({ name }, '-passwordHash').lean();
}

module.exports = {
  createRoom, joinRoom, onMemberJoin, onMemberLeave,
  touchActivity, cleanupOrphanMessages, getRoomInfo
};
