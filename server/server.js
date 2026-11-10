import http from 'node:http'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { WebSocketServer } from 'ws'

// In local development, the app keeps its shared .env in the repository root.
// Hosted environments can continue to provide these values as process env vars.
const localEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env')
if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath)

const { Pool } = pg
const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })
const port = Number(process.env.PORT || process.env.ROOM_PORT || 3001)
const jwtSecret = process.env.JWT_SECRET
if (!process.env.DATABASE_URL || !jwtSecret) {
  console.error('DATABASE_URL and JWT_SECRET are required.')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } })
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map((v) => v.trim()).filter(Boolean)
app.use(cors({ origin(origin, callback) { if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error('Origin not allowed')) }, credentials: false }))
app.use(express.json({ limit: '1mb' }))

await pool.query(`
CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS playlists (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS playlist_tracks (
 id BIGSERIAL PRIMARY KEY, playlist_id BIGINT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
 youtube_video_id VARCHAR(32) NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL,
 thumbnail TEXT, position INTEGER NOT NULL DEFAULT 0, UNIQUE(playlist_id, youtube_video_id)
);
CREATE TABLE IF NOT EXISTS rooms (
 room_code VARCHAR(8) PRIMARY KEY, room_state JSONB NOT NULL DEFAULT '{"queue":[],"current":0,"playing":false}',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`)

function tokenFor(user) { return jwt.sign({ sub: String(user.id), email: user.email, name: user.name }, jwtSecret, { expiresIn: '7d' }) }
function auth(req, res, next) {
 const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
 if (!token) return res.status(401).json({ error: 'Please log in.' })
 try { req.user = jwt.verify(token, jwtSecret); next() }
 catch { return res.status(401).json({ error: 'Your session expired. Please log in again.' }) }
}
function safeUser(row) { return { id: row.id, name: row.name, email: row.email } }

app.get('/health', async (_req, res) => {
 try { await pool.query('SELECT 1'); res.json({ ok: true }) }
 catch { res.status(503).json({ ok: false }) }
})
app.post('/api/auth/signup', async (req, res) => {
 try {
  const name = String(req.body.name || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '')
  if (!name || name.length > 80) return res.status(400).json({ error: 'Enter a name (up to 80 characters).' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (password.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters.' })
  const hash = await bcrypt.hash(password, 12)
  const { rows } = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email', [name,email,hash])
  res.status(201).json({ user: safeUser(rows[0]), token: tokenFor(rows[0]) })
 } catch (error) {
  if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' })
  console.error(error); res.status(500).json({ error: 'Could not create your account.' })
 }
})
app.post('/api/auth/login', async (req, res) => {
 try {
  const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '')
  const { rows } = await pool.query('SELECT id,name,email,password_hash FROM users WHERE email=$1', [email])
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' })
  res.json({ user: safeUser(rows[0]), token: tokenFor(rows[0]) })
 } catch (error) { console.error(error); res.status(500).json({ error: 'Could not log in.' }) }
})
app.get('/api/auth/me', auth, async (req, res) => {
 const { rows } = await pool.query('SELECT id,name,email FROM users WHERE id=$1', [req.user.sub])
 if (!rows[0]) return res.status(401).json({ error: 'Account no longer exists.' })
 res.json({ user: safeUser(rows[0]) })
})
app.get('/api/playlists', auth, async (req, res) => {
 const { rows } = await pool.query(`SELECT p.id,p.name,p.created_at, COALESCE(json_agg(json_build_object('id',t.youtube_video_id,'title',t.title,'artist',t.artist,'thumbnail',t.thumbnail) ORDER BY t.position) FILTER (WHERE t.id IS NOT NULL),'[]') AS tracks FROM playlists p LEFT JOIN playlist_tracks t ON t.playlist_id=p.id WHERE p.user_id=$1 GROUP BY p.id ORDER BY p.created_at DESC`, [req.user.sub])
 res.json({ playlists: rows })
})
app.post('/api/playlists', auth, async (req, res) => {
 const name = String(req.body.name || '').trim().slice(0,100) || 'Untitled playlist'
 const { rows } = await pool.query('INSERT INTO playlists(user_id,name) VALUES($1,$2) RETURNING id,name', [req.user.sub,name])
 res.status(201).json({ playlist: { ...rows[0], tracks: [] } })
})
app.patch('/api/playlists/:id', auth, async (req, res) => {
 const name = String(req.body.name || '').trim().slice(0,100)
 if (!name) return res.status(400).json({ error: 'Playlist name is required.' })
 const result = await pool.query('UPDATE playlists SET name=$1 WHERE id=$2 AND user_id=$3', [name,req.params.id,req.user.sub])
 if (!result.rowCount) return res.status(404).json({ error: 'Playlist not found.' })
 res.json({ ok: true })
})
app.delete('/api/playlists/:id', auth, async (req, res) => {
 const result = await pool.query('DELETE FROM playlists WHERE id=$1 AND user_id=$2', [req.params.id,req.user.sub])
 if (!result.rowCount) return res.status(404).json({ error: 'Playlist not found.' })
 res.json({ ok: true })
})
app.post('/api/playlists/:id/tracks', auth, async (req, res) => {
 const { id, title, artist, thumbnail } = req.body || {}
 if (!id || !title || !artist) return res.status(400).json({ error: 'Track information is incomplete.' })
 const owned = await pool.query('SELECT id FROM playlists WHERE id=$1 AND user_id=$2', [req.params.id,req.user.sub])
 if (!owned.rowCount) return res.status(404).json({ error: 'Playlist not found.' })
 await pool.query('INSERT INTO playlist_tracks(playlist_id,youtube_video_id,title,artist,thumbnail,position) VALUES($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(position)+1,0) FROM playlist_tracks WHERE playlist_id=$1)) ON CONFLICT(playlist_id,youtube_video_id) DO NOTHING', [req.params.id,String(id),String(title),String(artist),thumbnail || null])
 res.status(201).json({ ok: true })
})
app.delete('/api/playlists/:id/tracks/:trackId', auth, async (req, res) => {
 const owned = await pool.query('SELECT id FROM playlists WHERE id=$1 AND user_id=$2', [req.params.id,req.user.sub])
 if (!owned.rowCount) return res.status(404).json({ error: 'Playlist not found.' })
 await pool.query('DELETE FROM playlist_tracks WHERE playlist_id=$1 AND youtube_video_id=$2', [req.params.id,req.params.trackId])
 res.json({ ok: true })
})

const clients = new Set()
const validCode = (code) => /^[A-Z0-9]{4,8}$/.test(code)
async function sendRoom(client, roomCode) {
 const { rows } = await pool.query('SELECT room_state FROM rooms WHERE room_code=$1', [roomCode])
 client.send(JSON.stringify({ type: 'room', room: rows[0]?.room_state || { queue: [], current: 0, playing: false } }))
}
function broadcast(roomCode, payload) {
 for (const client of clients) if (client.roomCode === roomCode && client.readyState === 1) client.send(JSON.stringify(payload))
}
wss.on('connection', (socket) => {
 const client = socket; clients.add(client)
 socket.on('message', async (raw) => {
  try {
   const message = JSON.parse(raw.toString()), code = String(message.roomCode || client.roomCode || '').toUpperCase()
   if (!validCode(code)) return
   if (message.type === 'join') {
    client.roomCode = code
    const seed = message.room && Array.isArray(message.room.queue)
      ? { queue: message.room.queue.slice(0, 200), current: Math.max(0, Math.min(Number(message.room.current) || 0, message.room.queue.length - 1)), playing: Boolean(message.room.playing) }
      : { queue: [], current: 0, playing: false }
    await pool.query('INSERT INTO rooms(room_code,room_state) VALUES($1,$2) ON CONFLICT DO NOTHING', [code, JSON.stringify(seed)])
    await sendRoom(client, code)
    broadcast(code, { type: 'members', count: [...clients].filter((c) => c.roomCode === code && c.readyState === 1).length })
   }
   if (message.type === 'update' && client.roomCode === code && message.room && Array.isArray(message.room.queue)) {
    const room = { queue: message.room.queue.slice(0,200), current: Math.max(0,Math.min(Number(message.room.current)||0,message.room.queue.length-1)), playing: Boolean(message.room.playing) }
    await pool.query('INSERT INTO rooms(room_code,room_state,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(room_code) DO UPDATE SET room_state=EXCLUDED.room_state,updated_at=NOW()', [code,JSON.stringify(room)])
    broadcast(code, { type: 'room', room })
   }
  } catch (error) { console.error('WebSocket message error:', error.message) }
 })
 socket.on('close', () => { clients.delete(client); if (client.roomCode) broadcast(client.roomCode, { type: 'members', count: [...clients].filter((c) => c.roomCode === client.roomCode && c.readyState === 1).length }) })
})
server.on('upgrade', (request, socket, head) => {
 if (request.url !== '/ws') return socket.destroy()
 wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request))
})
server.listen(port, '0.0.0.0', () => console.log(`Jamroom API and rooms listening on :${port}`))
