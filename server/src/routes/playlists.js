// server/routes/playlists.js
// Mount with:  app.use('/api/playlists', playlistsRouter)
//
// ASSUMPTIONS (adjust the three imports/lines marked "ADJUST" to match your server):
//   - ES modules (import/export)
//   - `pool` is your pg Pool
//   - requireAuth verifies the Bearer token and sets req.user.id
import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'  

const router = Router()
router.use(requireAuth)

const userId = (req) => req.userId                  
const MAX_TRACKS = 200

// ── Helpers ───────────────────────────────────────────────────────────────────
const wrap = (handler) => (req, res) => handler(req, res).catch((error) => {
  console.error(error)
  res.status(500).json({ error: 'Something went wrong on the server.' })
})

const parseId = (value) => {
  const id = String(value ?? '')
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null
}

const cleanName = (value) => String(value ?? '').trim().slice(0, 60)

// Same shape the React app already uses: { id, title, artist, thumbnail, duration?, lyricsId? }
function cleanTrack(raw) {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return null
  const title = String(raw.title ?? '').trim().slice(0, 300)
  if (!title) return null
  return {
    id: raw.id.trim().slice(0, 32),
    title,
    artist: String(raw.artist ?? '').trim().slice(0, 200),
    thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail.slice(0, 500) : null,
    duration: Number.isFinite(raw.duration) ? Math.round(raw.duration) : null,
    lyricsId: Number.isInteger(raw.lyricsId) ? raw.lyricsId : null,
  }
}

// One query returns each playlist with its songs already in order.
// $2 = null  -> every playlist of the user, $2 = id -> just that one.
const SELECT_PLAYLISTS = `
  SELECT p.id, p.name, p.created_at AS "createdAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', t.video_id,
               'title', t.title,
               'artist', t.artist,
               'thumbnail', t.thumbnail,
               'duration', t.duration,
               'lyricsId', t.lyrics_id
             ) ORDER BY t.position
           ) FILTER (WHERE t.video_id IS NOT NULL),
           '[]'
         ) AS tracks
  FROM playlists p
  LEFT JOIN playlist_tracks t ON t.playlist_id = p.id
  WHERE p.user_id = $1 AND ($2::uuid IS NULL OR p.id = $2::uuid)
  GROUP BY p.id
  ORDER BY p.created_at DESC, p.id DESC`

const fetchPlaylists = async (db, uid, playlistId = null) => {
  const { rows } = await db.query(SELECT_PLAYLISTS, [uid, playlistId])
  return rows
}

// position = current max + 1; ON CONFLICT makes adding the same song twice a no-op.
const INSERT_TRACK = `
  INSERT INTO playlist_tracks (
    playlist_id,
    video_id,
    position,
    title,
    artist,
    thumbnail,
    duration,
    lyrics_id
  )
  VALUES (
    $1,
    $2,
    (SELECT COALESCE(MAX(position), -1) + 1
     FROM playlist_tracks
     WHERE playlist_id = $1),
    $3, $4, $5, $6, $7
  )
  ON CONFLICT (playlist_id, video_id) DO NOTHING`

const trackParams = (playlistId, t) => [playlistId, t.id, t.title, t.artist, t.thumbnail, t.duration, t.lyricsId]

const ownsPlaylist = async (playlistId, uid) => {
  const { rowCount } = await pool.query('SELECT 1 FROM playlists WHERE id = $1 AND user_id = $2', [playlistId, uid])
  return rowCount > 0
}

// ── GET /api/playlists ────────────────────────────────────────────────────────
router.get('/', wrap(async (req, res) => {
  res.json({ playlists: await fetchPlaylists(pool, userId(req)) })
}))

// ── POST /api/playlists   body: { name, tracks?: [] } ─────────────────────────
router.post('/', wrap(async (req, res) => {
  const name = cleanName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'Enter a playlist name.' })
  const tracks = (Array.isArray(req.body?.tracks) ? req.body.tracks : [])
    .map(cleanTrack).filter(Boolean).slice(0, MAX_TRACKS)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [created] } = await client.query(
      'INSERT INTO playlists (user_id, name) VALUES ($1, $2) RETURNING id', [userId(req), name])
    for (const track of tracks) await client.query(INSERT_TRACK, trackParams(created.id, track))
    await client.query('COMMIT')
    const [playlist] = await fetchPlaylists(pool, userId(req), created.id)
    res.status(201).json({ playlist })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ── PATCH /api/playlists/:id   body: { name } ─────────────────────────────────
router.patch('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id)
  const name = cleanName(req.body?.name)
  if (!id) return res.status(400).json({ error: 'Invalid playlist.' })
  if (!name) return res.status(400).json({ error: 'Enter a playlist name.' })

  const { rowCount } = await pool.query(
    'UPDATE playlists SET name = $1 WHERE id = $2 AND user_id = $3', [name, id, userId(req)])
  if (!rowCount) return res.status(404).json({ error: 'Playlist not found.' })
  const [playlist] = await fetchPlaylists(pool, userId(req), id)
  res.json({ playlist })
}))

// ── DELETE /api/playlists/:id ─────────────────────────────────────────────────
router.delete('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid playlist.' })
  const { rowCount } = await pool.query('DELETE FROM playlists WHERE id = $1 AND user_id = $2', [id, userId(req)])
  if (!rowCount) return res.status(404).json({ error: 'Playlist not found.' })
  res.json({ ok: true })
}))

// ── POST /api/playlists/:id/tracks   body: { track } ──────────────────────────
router.post('/:id/tracks', wrap(async (req, res) => {
  const id = parseId(req.params.id)
  const track = cleanTrack(req.body?.track)
  if (!id) return res.status(400).json({ error: 'Invalid playlist.' })
  if (!track) return res.status(400).json({ error: 'That song is missing details.' })
  if (!(await ownsPlaylist(id, userId(req)))) return res.status(404).json({ error: 'Playlist not found.' })

  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM playlist_tracks WHERE playlist_id = $1', [id])
  if (count >= MAX_TRACKS) return res.status(400).json({ error: `A playlist can hold up to ${MAX_TRACKS} songs.` })

  await pool.query(INSERT_TRACK, trackParams(id, track))
  const [playlist] = await fetchPlaylists(pool, userId(req), id)
  res.json({ playlist })
}))

// ── DELETE /api/playlists/:id/tracks/:trackId ─────────────────────────────────
router.delete('/:id/tracks/:trackId', wrap(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid playlist.' })
  if (!(await ownsPlaylist(id, userId(req)))) return res.status(404).json({ error: 'Playlist not found.' })

 await pool.query(
  'DELETE FROM playlist_tracks WHERE playlist_id = $1 AND video_id = $2',
  [id, req.params.trackId]
)
  const [playlist] = await fetchPlaylists(pool, userId(req), id)
  res.json({ playlist })
}))

export default router