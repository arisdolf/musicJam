import 'dotenv/config'
import fs from 'node:fs'
import pg from 'pg'
import admin from 'firebase-admin'

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync('./service-account.json', 'utf8'))),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
})
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
})

// 1) Users, with their bcrypt hashes, so existing passwords keep working
const { rows: users } = await pool.query('SELECT * FROM users')
const withPassword = users.filter((u) => u.password_hash)
console.log(`Skipping ${users.length - withPassword.length} users without a password hash`)

for (let i = 0; i < withPassword.length; i += 1000) {
  const batch = withPassword.slice(i, i + 1000).map((u) => ({
    uid: u.id,
    email: u.email,
    displayName: u.name,
    passwordHash: Buffer.from(u.password_hash),
  }))
  const result = await admin.auth().importUsers(batch, { hash: { algorithm: 'BCRYPT' } })
  console.log(`Users: ${result.successCount} ok, ${result.failureCount} failed`, result.errors)
}

// 2) Playlists + tracks
const { rows: playlists } = await pool.query('SELECT * FROM playlists')
const { rows: tracks } = await pool.query('SELECT * FROM playlist_tracks ORDER BY position')
const byPlaylist = new Map()
for (const t of tracks) {
  if (!byPlaylist.has(t.playlist_id)) byPlaylist.set(t.playlist_id, {})
  byPlaylist.get(t.playlist_id)[t.video_id] = {
    title: t.title, artist: t.artist || '', thumbnail: t.thumbnail || null,
    duration: t.duration || null, lyricsId: t.lyrics_id ? Number(t.lyrics_id) : null,
    position: t.position, addedAt: new Date(t.added_at).getTime(),
  }
}
const tree = {}
for (const p of playlists) {
  tree[`${p.user_id}/${p.id}`] = {
    name: p.name, createdAt: new Date(p.created_at).getTime(), tracks: byPlaylist.get(p.id) || {},
  }
}
await admin.database().ref('playlists').update(tree)
console.log(`Playlists: ${playlists.length}, tracks: ${tracks.length}`)

await pool.end()
process.exit(0)