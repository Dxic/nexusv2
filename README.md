
# Nexus Chat v2

Ephemeral, password-protected chat index automatically removes the Room document when rooms with randomly generated, permanently reserved identities.

Built with Node.js, Express, Socket.IO and MongoDB. Supports image/file upload via Cloudinary and automatic cleanup of empty/expired rooms.

## `expiresAt` is reached Features

- Create password-protected rooms (names are sanitized and limited to 32 characters)
- Join rooms with a password
- Random unique username generation (Adjective_Noun##) — each username is reserved in the DB.
- A periodic cleanup job (runs hourly) removes orphaned forever
- Ephemeral rooms: when the last member leaves the room is scheduled to expire (24 hours) and MongoDB TTL index deletes it
- Hourly messages (messages referencing rooms that no cleanup job removes orphaned messages
- File upload endpoint that stores files on Cloudinary
- Static longer exist).
- When a new frontend served from `public/`

## Quick start

1. Clone the repo:
   git member joins, `expiresAt clone https://github.com/Dxic/nexusv2.git
   cd nexusv2

2. Install dependencies:
   npm install

3. Create a `.env` file in the project` is unset and `memberCount root with the required environment variables (see below).

4. Run:
   - Production: npm start
   - Development (auto-reload): npm run dev

` increments.

## Security notesBy default the server listens on PORT (defaults to 3000).

## Environment variables

The server expects the following environment variables:

- MONGODB_URI — MongoDB connection string (required)
-
- Room passwords are hashed with CLOUDINARY_CLOUD_NAME — Cloudinary cloud name (required for uploads)
- CLOUDINARY_API_KEY — Cloudinary API key ( bcrypt before storage.
- Generatedrequired for uploads)
- CLOUD usernames are permanently reserved (stored inINARY_API_SECRET — Cloudinary API secret (required for uploads)
- PORT — optional, port to `UsedUsername`) to guarantee run the server on (defaults to 3000)

Example `.env`:
MONGODB_URI=mongodb+srv://user:pass@cluster.example.com/mydb
CLOUDINARY_CLOUD uniqueness.
- Ensure your MongoDB_NAME=your-cloud-name
 instance and Cloudinary credentials are secured; do not commit `.envCLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET` to source control.

## Dependencies=yyy
PORT=300
Key runtime dependencies (from0

## Available scripts

- package.json):
- express
- socket.io
- mongoose
 npm start — start server (node server.js)
- npm run dev — start server with nodemon for development

## HTTP API

All endpoints are prefixed with- dotenv
- bcryptjs
- multer
- cloudinary `/api`.

- POST /api/username
  - Generate
- streamifier
- multer a new unique username.
  - Response: 200 { "-storage-cloudinary

Dev dependency:
- nodemon

