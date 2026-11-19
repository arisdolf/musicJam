// api/youtube.js
const KEYS = (process.env.YOUTUBE_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean)
const QUOTA_REASONS = ['quotaExceeded', 'dailyLimitExceeded', 'RESOURCE_EXHAUSTED']
const KEY_PROBLEMS = ['keyInvalid', 'API_KEY_INVALID', 'ipRefererBlocked']
const dead = new Set() // best effort: resets on cold start


const looksLikeQuota = (data, status) => {
  const reason = data.error?.errors?.[0]?.reason || ''
  return QUOTA_REASONS.includes(reason)
    || QUOTA_REASONS.includes(data.error?.status || '')
    || status === 429
    || /quota/i.test(data.error?.message || '')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { path, keyIndex, ...params } = req.query
  if (!['search', 'videos'].includes(path)) {
    return res.status(400).json({ error: { message: 'Bad path' } })
  }
  if (!KEYS.length) {
    return res.status(500).json({ error: { message: 'No API keys configured on the server.' } })
  }

  // If the client picked a key, try that one first, then fall through to the rest.
  const first = Number.isInteger(Number(keyIndex)) && KEYS[Number(keyIndex)] ? Number(keyIndex) : 0
  const order = [first, ...KEYS.map((_, i) => i).filter((i) => i !== first)]
    .sort((a, b) => (dead.has(a) ? 1 : 0) - (dead.has(b) ? 1 : 0)) // untried-dead keys go last, not skipped

  for (const i of order) {
    const url = `https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key: KEYS[i] })}`
    const r = await fetch(url)
    const data = await r.json().catch(() => ({}))

    if (r.ok) {
      dead.delete(i)
      return res.status(200).json(data)
    }

    const reason = data.error?.errors?.[0]?.reason || data.error?.status || ''
    if (looksLikeQuota(data, r.status) || KEY_PROBLEMS.includes(reason)) {
      dead.add(i)
      continue // try the next key
    }
    return res.status(r.status).json(data) // a real error: don't burn other keys
  }

  res.status(429).json({
    error: { errors: [{ reason: 'quotaExceeded' }], message: 'All keys exhausted' },
  })
}