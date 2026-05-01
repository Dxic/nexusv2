/**
 * ============================================================
 * NEXUS CHAT v2 — SERVER (FINAL PRODUCTION)
 * ============================================================
 */

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();

const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const mongoose  = require('mongoose');
const path      = require('path');
const multer    = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const { generateUniqueUsername } = require('./services/usernameService');
const { createRoom, joinRoom, cleanupOrphanMessages, getRoomInfo, deleteRoom } = require('./services/roomService');
const { handleConnection, getRoomUsers } = require('./sockets/chatSocket');

const app    = express();
const server = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────────
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB ──────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB:', err.message);
    process.exit(1);
  });

// ── Cloudinary ───────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer();

// ── REST API ─────────────────────────────────────────────────

// Generate username
app.post('/api/username', async (req, res) => {
  try {
    const username = await generateUniqueUsername();
    res.json({ username });
  } catch {
    res.status(500).json({ error: 'Could not generate username' });
  }
});

// Create room
app.post('/api/rooms', async (req, res) => {
  const { name, password, createdBy } = req.body;

  if (!name || !password || !createdBy)
    return res.status(400).json({ error: 'Missing fields' });

  const safeName = name.trim().toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 32);

  if (!safeName)
    return res.status(400).json({ error: 'Invalid room name' });

  try {
    const room = await createRoom(safeName, password, createdBy);
    res.json({ room: room.name });
  } catch (e) {
    if (e.message === 'ROOM_EXISTS')
      return res.status(409).json({ error: 'Room name already taken' });

    res.status(500).json({ error: 'Server error' });
  }
});

// Join room
app.post('/api/rooms/join', async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    const room = await joinRoom(name.toLowerCase(), password);
    res.json({ room: room.name, createdBy: room.createdBy, ok: true });
  } catch (e) {
    if (e.message === 'ROOM_NOT_FOUND')
      return res.status(404).json({ error: 'Room tidak ditemukan atau sudah expired' });

    if (e.message === 'WRONG_PASSWORD')
      return res.status(401).json({ error: 'Password salah' });

    res.status(500).json({ error: 'Server error' });
  }
});

// Room info
app.get('/api/rooms/:name/info', async (req, res) => {
  try {
    const roomName = req.params.name.toLowerCase();
    const info = await getRoomInfo(roomName);

    if (!info)
      return res.status(404).json({ exists: false });

    // Use live socket users to avoid DB drift ghost counts
    const liveUsers = getRoomUsers(roomName);

    res.json({
      exists: true,
      name: info.name,
      members: liveUsers.length
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete room (only creator)
app.delete('/api/rooms/:name', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    await deleteRoom(req.params.name.toLowerCase(), username);
    io.to(req.params.name.toLowerCase()).emit('roomDeleted', { message: 'Room ini telah dihapus oleh pembuatnya.' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message === 'ROOM_NOT_FOUND') return res.status(404).json({ error: 'Room not found' });
    if (e.message === 'NOT_AUTHORIZED') return res.status(403).json({ error: 'Not authorized' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload image/file
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const stream = cloudinary.uploader.upload_stream(
    { resource_type: 'auto' },
    (error, result) => {
      if (error) return res.status(500).json({ error: 'Upload failed' });
      res.json({ url: result.secure_url });
    }
  );

  streamifier.createReadStream(req.file.buffer).pipe(stream);
});

// ── Socket ───────────────────────────────────────────────────
io.on('connection', (socket) => handleConnection(io, socket));

// ── Cleanup Job ──────────────────────────────────────────────
setInterval(async () => {
  try {
    const n = await cleanupOrphanMessages();
    if (n > 0) console.log(`🧹 Cleaned ${n} orphan messages`);
  } catch (err) {
    console.log('Cleanup error:', err.message);
  }
}, 60 * 60 * 1000);

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Nexus Chat v2 running on port ${PORT}`);
});