/**
 * Chat Service — Message persistence
 */
const Message = require('../models/Message');

async function saveMessage({ username, room, message }) {
  return Message.create({ username, room, message });
}

async function getRoomHistory(room, limit = 60) {
  const docs = await Message.find({ room })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
  return docs.reverse();
}

function formatMessage({ username, room, message, timestamp }) {
  return { username, room, message, timestamp: timestamp || new Date() };
}

module.exports = { saveMessage, getRoomHistory, formatMessage };
