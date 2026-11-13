import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth.js'
import playlistsRouter from './routes/playlists.js';
import roomsRouter from './routes/rooms.js'
const app = express()

app.set('trust proxy', 1) // so rate limiting sees real IPs behind Render/Railway
app.use(helmet())
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }), authRoutes)
app.use('/api/playlists', playlistsRouter)
app.use('/api/rooms', roomsRouter)

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err)
  res.status(500).json({ error: 'Something went wrong. Try again.' })
})

app.listen(process.env.PORT || 3001, () => console.log('Jamroom API running'))