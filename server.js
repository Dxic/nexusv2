/**
 * ============================================================
 * NEXUS CHAT v2 — Server
 * ============================================================
 * REST endpoints:
 *   POST /api/username          → generate unique username
 *   POST /api/rooms             → create room with password
 *   POST /api/rooms/join        → verify password before socket entry
 *   GET  /api/rooms/:name/info  → check if room exists
 *
 * Socket events handled in sockets/chatSocket.js
 * ============================================================
 */

require('dotenv').config();
const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const mongoose  = require('mongoose');
const path      = require('path');

const { generateUniqueUsername }              = require('./services/usernameService');
const { createRoom, joinRoom, cleanupOrphanMessages, getRoomInfo } = require('./services/roomService');
const { handleConnection }                    = require('./sockets/chatSocket');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB ────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexuschat';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB:', err.message));

// ── REST API ───────────────────────────────────────────────────

/**
 * Generate a globally unique username.
 * Client stores it in localStorage — never changes for that browser.
 */
app.post('/api/username', async (req, res) => {
  try {
    const username = await generateUniqueUsername();
    res.json({ username });
  } catch (e) {
    res.status(500).json({ error: 'Could not generate username' });
  }
});

/**
 * Create a new password-protected room.
 */
app.post('/api/rooms', async (req, res) => {
  const { name, password, createdBy } = req.body;
  if (!name || !password || !createdBy)
    return res.status(400).json({ error: 'Missing fields' });

  const safeName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);
  if (!safeName) return res.status(400).json({ error: 'Invalid room name' });

  try {
    const room = await createRoom(safeName, password, createdBy);
    res.json({ room: room.name });
  } catch (e) {
    if (e.message === 'ROOM_EXISTS')
      return res.status(409).json({ error: 'Room name already taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Verify room password — returns a session token (just username+room for simplicity).
 * Client uses this confirmation to then emit 'enterRoom' via socket.
 */
app.post('/api/rooms/join', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    const room = await joinRoom(name.toLowerCase(), password);
    res.json({ room: room.name, ok: true });
  } catch (e) {
    if (e.message === 'ROOM_NOT_FOUND')
      return res.status(404).json({ error: 'Room tidak ditemukan atau sudah expired' });
    if (e.message === 'WRONG_PASSWORD')
      return res.status(401).json({ error: 'Password salah' });
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Check if a room exists (for UI feedback before user types password).
 */
app.get('/api/rooms/:name/info', async (req, res) => {
  const info = await getRoomInfo(req.params.name.toLowerCase());
  if (!info) return res.status(404).json({ exists: false });
  res.json({ exists: true, name: info.name, members: info.memberCount });
});

// ── Socket ─────────────────────────────────────────────────────
io.on('connection', (socket) => handleConnection(io, socket));

// ── Cleanup job: orphan messages every hour ────────────────────
setInterval(async () => {
  try {
    const n = await cleanupOrphanMessages();
    if (n > 0) console.log(`🧹 Cleaned ${n} orphan messages`);
  } catch (_) {}
}, 60 * 60 * 1000);

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Nexus Chat v2 → http://localhost:${PORT}`));
