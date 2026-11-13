import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool } from '../db.js'
import { requireAuth, signToken } from '../middleware/auth.js'

const router = Router()
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12) // keeps login timing similar for unknown emails

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254)
const password = z.string().min(6, 'Use a password with at least 6 characters.').max(72)
const name = z.string().trim().min(1, 'Enter your name.').max(60)

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, hasPassword: Boolean(u.password_hash) })
const fail = (res, parsed) => res.status(400).json({ error: parsed.error.issues[0].message })

router.post('/signup', async (req, res, next) => {
  try {
    const parsed = z.object({ name, email, password }).safeParse(req.body)
    if (!parsed.success) return fail(res, parsed)
    const hash = await bcrypt.hash(parsed.data.password, 12)
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [parsed.data.name, parsed.data.email, hash],
    )
    res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' })
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const parsed = z.object({ email, password: z.string().min(1).max(72) }).safeParse(req.body)
    if (!parsed.success) return res.status(401).json({ error: 'Email or password is incorrect.' })
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [parsed.data.email])
    const user = rows[0]
    const ok = await bcrypt.compare(parsed.data.password, user?.password_hash || DUMMY_HASH)
    if (!user || !user.password_hash || !ok) return res.status(401).json({ error: 'Email or password is incorrect.' })
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (err) { next(err) }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId])
    if (!rows[0]) return res.status(401).json({ error: 'Account no longer exists.' })
    res.json({ user: publicUser(rows[0]) })
  } catch (err) { next(err) }
})

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({ name }).safeParse(req.body)
    if (!parsed.success) return fail(res, parsed)
    const { rows } = await pool.query('UPDATE users SET name = $1 WHERE id = $2 RETURNING *', [parsed.data.name, req.userId])
    res.json({ user: publicUser(rows[0]) })
  } catch (err) { next(err) }
})

router.post('/password', requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({ currentPassword: z.string().min(1).max(72), newPassword: password }).safeParse(req.body)
    if (!parsed.success) return fail(res, parsed)
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId])
    const user = rows[0]
    if (!user?.password_hash || !(await bcrypt.compare(parsed.data.currentPassword, user.password_hash))) {
      return res.status(403).json({ error: 'Current password is incorrect.' })
    }
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(parsed.data.newPassword, 12), req.userId])
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId])
    const user = rows[0]
    if (user?.password_hash && !(await bcrypt.compare(String(req.body?.password || ''), user.password_hash))) {
      return res.status(403).json({ error: 'Password is incorrect.' })
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]) // playlists cascade
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router