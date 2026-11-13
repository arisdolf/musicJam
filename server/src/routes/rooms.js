import { Router } from 'express'
import { z } from 'zod'
import pool from '../db.js'

const router = Router()

router.param('code', (req, res, next, value) => {
  const code = String(value).toUpperCase()
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return res.status(400).json({ error: 'Invalid room code.' })
  req.code = code
  next()
})

const body = z.object({
  queue: z.array(z.object({ id: z.string() }).passthrough()).max(200),
  current: z.number().int().min(0),
  playing: z.boolean(),
})

// Read the room, create it if missing, and record this client's heartbeat.
router.get('/:code', async (req, res, next) => {
  try {
    const client = String(req.query.client || '').slice(0, 64)
    await pool.query('INSERT INTO rooms (code) VALUES ($1) ON CONFLICT DO NOTHING', [req.code])
    if (client) {
      await pool.query(
        `INSERT INTO room_members (code, client_id) VALUES ($1, $2)
         ON CONFLICT (code, client_id) DO UPDATE SET last_seen = now()`,
        [req.code, client])
    }
    const { rows: [room] } = await pool.query(
      'SELECT queue, current, playing, version FROM rooms WHERE code = $1', [req.code])
    const { rows: [m] } = await pool.query(
      `SELECT count(*)::int AS n FROM room_members
       WHERE code = $1 AND last_seen > now() - interval '20 seconds'`, [req.code])
    res.json({ room, members: Math.max(1, m.n) })
  } catch (err) { next(err) }
})

router.put('/:code', async (req, res, next) => {
  try {
    const data = body.parse(req.body)
    const current = Math.min(data.current, Math.max(0, data.queue.length - 1))
    const { rows: [room] } = await pool.query(
      `INSERT INTO rooms (code, queue, current, playing, version) VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (code) DO UPDATE
         SET queue = $2, current = $3, playing = $4, version = rooms.version + 1, updated_at = now()
       RETURNING version`,
      [req.code, JSON.stringify(data.queue), current, data.playing])
    res.json({ version: room.version })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid room data.' })
    next(err)
  }
})

export default router