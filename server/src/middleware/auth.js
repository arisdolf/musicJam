
import 'dotenv/config'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET

if (!SECRET) throw new Error('JWT_SECRET is missing from .env')

export const signToken = (user) =>
  jwt.sign({ sub: user.id }, SECRET, { expiresIn: '7d' })

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' })
  }

  try {
    req.userId = jwt.verify(token, SECRET).sub
    next()
  } catch {
    res.status(401).json({
      error: 'Session expired. Please log in again.'
    })
  }
}
