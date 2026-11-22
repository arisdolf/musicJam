// Remembers what the listener plays and turns it into a taste profile (this browser only).
const KEY = 'jamroom:taste'
const MAX_PLAYS = 300
const HALF_LIFE_DAYS = 14
const MIN_TAG_SCORE = 1.5 // a vibe must show up a few times before it counts as taste

// Tag ids match the genre tab ids in services/feeds.js.
const TAGS = [
  ['pinoy', /tagalog|opm|filipino|pinoy|\b(ikaw|ako|kita|sayo|pag-ibig|bakit|ngayon|walang|tayo|puso|mahal|buhay|pangako)\b/i],
  ['kpop', /k-?pop|[\uAC00-\uD7AF]/i],
  ['gloomy', /\b(sad|hugot|heartbreak|broken|cry|iyak|luha|lonely|miss you|sakit|goodbye|paalam|alone|tears)\b/i],
  ['chill', /\b(chill|lofi|lo-fi|relax|calm|acoustic|sleep)\b/i],
  ['love', /\b(love|romantic|romance|mahal|kilig|serenade|valentine)\b/i],
  ['party', /\b(party|dance|club|upbeat|hype)\b/i],
  ['hiphop', /\b(hip[- ]?hop|rap|trap|drill)\b/i],
  ['rnb', /\b(r&b|rnb)\b/i],
  ['rock', /\brock\b/i],
]

const norm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '')

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch { return [] }
}

export function tagsFor(track) {
  const text = `${track?.title || ''} ${track?.artist || ''}`
  return TAGS.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
}

export function recordPlay(track) {
  if (!track?.id) return
  const plays = read()
  plays.push({
    at: Date.now(),
    tags: tagsFor(track),
    track: { id: track.id, title: track.title, artist: track.artist || '', thumbnail: track.thumbnail || '', duration: track.duration || 0 },
  })
  try { localStorage.setItem(KEY, JSON.stringify(plays.slice(-MAX_PLAYS))) } catch { /* storage is optional */ }
}

export function getTaste() {
  const plays = read()
  const now = Date.now()
  const artists = new Map()
  const tags = new Map()

  for (const play of plays) {
    const weight = Math.pow(0.5, (now - play.at) / (HALF_LIFE_DAYS * 86400000))
    const name = String(play.track?.artist || '').trim()
    const key = norm(name)
    if (key.length >= 2 && key !== 'unknown') {
      const entry = artists.get(key) || { name, score: 0 }
      entry.score += weight
      artists.set(key, entry)
    }
    for (const tag of play.tags || []) tags.set(tag, (tags.get(tag) || 0) + weight)
  }

  const topArtists = [...artists.values()].sort((a, b) => b.score - a.score).slice(0, 3).map((a) => a.name)
  const topTags = [...tags.entries()].filter(([, score]) => score >= MIN_TAG_SCORE).sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const last = plays[plays.length - 1]

  return {
    count: plays.length,
    artists: topArtists,
    tags: topTags,
    seed: last?.track || null,
    recentIds: plays.slice(-12).map((play) => play.track.id),
    signature: `${topArtists.map(norm).join('+')}|${topTags[0] || ''}`,
  }
}