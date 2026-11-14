// api/youtube.js
const KEYS = (process.env.YOUTUBE_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean)
const QUOTA_REASONS = ['quotaExceeded', 'dailyLimitExceeded', 'RESOURCE_EXHAUSTED']
let dead = new Set() // best effort: resets when the function cold-starts

export default async function handler(req, res) {
  const { path, ...params } = req.query
  if (!['search', 'videos'].includes(path)) return res.status(400).json({ error: 'bad path' })
    
  for (let i = 0; i < KEYS.length; i++) {
    if (dead.has(i)) continue
    const url = `https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key: KEYS[i] })}`
    const r = await fetch(url)
    const data = await r.json().catch(() => ({}))
    if (r.ok) return res.status(200).json({ ...data, _key: i, _dead: [...dead] })

const reason = data.error?.errors?.[0]?.reason || data.error?.status || ''
if (QUOTA_REASONS.includes(reason)) { dead.add(i); continue }
return res.status(r.status).json(data)
}
res.status(429).json({
  error: { errors: [{ reason: 'quotaExceeded' }], message: 'All keys exhausted' },
  _dead: [...dead],
})
}

