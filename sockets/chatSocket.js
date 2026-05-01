/**
 * Socket Layer — Real-time event handling
 * Integrates with roomService for member tracking and expiry.
 */
const { saveMessage, getRoomHistory, formatMessage } = require('../services/chatService');
const { onMemberJoin, onMemberLeave, touchActivity }  = require('../services/roomService');

// socketId → { username, room }
const onlineUsers = new Map();

function getRoomUsers(room) {
  const users = [];
  for (const [, data] of onlineUsers) {
    if (data.room === room) users.push(data.username);
  }
  return [...new Set(users)];
}

async function handleConnection(io, socket) {

  // ── ENTER ROOM (after password verified by REST) ──────────────
  socket.on('enterRoom', async ({ username, room }) => {
    // Leave previous room if any
    const prev = onlineUsers.get(socket.id);
    if (prev && prev.room !== room) {
      socket.leave(prev.room);
      await onMemberLeave(prev.room).catch(() => {});
      io.to(prev.room).emit('roomUsers', { room: prev.room, users: getRoomUsers(prev.room) });
      io.to(prev.room).emit('systemMessage', { text: `${prev.username} left`, timestamp: new Date() });
    }

    socket.join(room);
    onlineUsers.set(socket.id, { username, room });
    await onMemberJoin(room).catch(() => {});

    // Load history
    try {
      const history = await getRoomHistory(room, 60);
      socket.emit('messageHistory', history);
    } catch (_) {}

    io.to(room).emit('roomUsers', { room, users: getRoomUsers(room) });
    io.to(room).emit('systemMessage', { text: `${username} joined`, timestamp: new Date() });
  });

  // ── SEND MESSAGE ──────────────────────────────────────────────
  socket.on('chatMessage', async ({ message, type, meta }) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const { username, room } = user;
    const payload = { ...formatMessage({ username, room, message, type, meta }) };

    io.to(room).emit('message', payload);

    // Simpan ke DB
    try {
      await saveMessage({ username, room, message, type, meta });
      await touchActivity(room);
    } catch (_) {}
  });

  // ── TYPING ────────────────────────────────────────────────────
  socket.on('typing', ({ isTyping }) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    socket.to(user.room).emit('typing', { username: user.username, isTyping });
  });

  // ── DISCONNECT ────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    onlineUsers.delete(socket.id);

    const { username, room } = user;
    await onMemberLeave(room).catch(() => {});
    io.to(room).emit('roomUsers', { room, users: getRoomUsers(room) });
    io.to(room).emit('systemMessage', { text: `${username} left`, timestamp: new Date() });
  });
}

module.exports = { handleConnection, getRoomUsers };
