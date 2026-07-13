Nexus Chat v2 is a lightweight Node.js/Express chat server using Socket.IO, MongoDB and Cloudinary. It provides short-lived, password-protected rooms and issues random adjective_noun usernames which are permanently reserved.

## Features
- Create and join password-protected rooms
- Ephemeral rooms: rooms are automatically expired and deleted when empty for 24 hours
- Random, unique usernames reserved in the database
- File/image uploads via Cloudinary
- Real-time messaging via Socket.IO
- Hourly cleanup job to remove orphaned messages

## Architecture
- Express.js server (REST API + static files)
- Socket.IO for real-time messaging
- MongoDB (mongoose) for persistence
- Cloudinary for uploads handled via multer + streamifier
- Business logic separated into `services/` and socket handlers in `sockets/`

## Quickstart
1. Clone the repository
   git clone https://github.com/Dxic/nexusv2.git
2. Install dependencies
   npm install
3. Create a `.env` file (see below)
4. Start the server
   npm start
   - or for development with auto-reload:
     npm run dev

Default port: 3000 (can be overridden by `PORT` env var).

## Environment variables
Create a `.env` in the project root with at least the following variables:

MONGODB_URI=your_mongodb_connection_string
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=3000

## Available scripts
- `npm start` — start server (node server.js)
- `npm run dev` — start server with nodemon for development

## HTTP API
All API routes are prefixed with `/api`.

- POST /api/username
  - Generates a random, unique username and permanently reserves it.
  - Response: `{ "username": "adj_noun34" }`

- POST /api/rooms
  - Create a new room (password-protected).
  - Body: `{ "name": "roomname", "password": "secret", "createdBy": "username" }`
  - Response: `{ "room": "<safeRoomName>" }`
  - Errors:
    - 400 — missing/invalid fields
    - 409 — room already exists

- POST /api/rooms/join
  - Join an existing room (verify password).
  - Body: `{ "name": "roomname", "password": "secret" }`
  - Response: `{ "room": "<name>", "createdBy": "<creator>", "ok": true }`
  - Errors:
    - 400 — missing fields
    - 404 — room not found / expired
    - 401 — wrong password

- GET /api/rooms/:name/info
  - Get room info (exists, name, live member count).
  - Response when exists: `{ "exists": true, "name": "...", "members": 3 }`
  - Response when not found: `{ "exists": false }`

- DELETE /api/rooms/:name
  - Delete a room (only the creator may delete).
  - Body: `{ "username": "creatorUsername" }`
  - Response: `{ "ok": true }`
  - Emits `roomDeleted` via Socket.IO to the room on success.

- POST /api/upload
  - Upload an image/file (multipart form-data, field name `file`).
  - Uses Cloudinary; returns `{ "url": "<secure_url>" }`.

## Socket.IO integration
The server initializes Socket.IO and delegates socket event handling to the socket handler exported by `sockets/chatSocket` (imported as `handleConnection` in `server.js`).

- The server emits a `roomDeleted` event to a room when it is deleted via the HTTP API.
- `getRoomUsers(roomName)` is used to compute live member counts for `/api/rooms/:name/info`.

(Refer to `sockets/` for full socket event names and payload shapes.)

## Data models
Defined with mongoose in `models/`:

- Room
  - name (unique, lowercase)
  - passwordHash
  - createdBy
  - lastActivity (Date)
  - memberCount (Number)
  - expiresAt (Date) — TTL index set to auto-delete document when reached

- Message
  - username
  - room
  - message (max length 2000)
  - type (default 'text')
  - meta (mixed)
  - timestamp

- UsedUsername
  - username (unique)
  - createdAt

## Room lifecycle & cleanup
- When the last member leaves, `expiresAt` is set to now + 24 hours````markdown name=README.md url=https://github.
- A MongoDB TTL.com/Dxic/nexusv2/blob/main/README.md
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

## Contributing
- Issues and pullusername": "swift_falcon requests are welcome.
- Add tests42" }
  - Errors: 500 on failure.

- POST /api/rooms
  and keep changes focused.
- Update README and changelog for user-visible changes.

## License
No - Create a new room.
  - Body: { "name license file is included in the": "<roomName>", "password repository. Add a LICENSE file to": "<password>", "createdBy": "<username>" }
  make the project's license explicit.

 - Response: 200 {## Acknowledgements
Built with "room": "<roomName>" Express, Socket.IO, Mongo }
  - Errors: DB and Cloudinary. Thanks to400 missing/invalid fields,  the open-source community for these tools.
```409 room already taken, 500
