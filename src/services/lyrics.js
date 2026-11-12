// src/services/lyrics.js
// Synced lyrics from LRCLIB. Looks each track up by title + artist and picks the
// best match using the video's duration, so lyrics line up with the right version.
const LRCLIB_API = 'https://lrclib.net/api'

const recordCache = new Map() // lyricsId -> record
const resultCache = new Map() // track key -> record | null

// ── Parsing ───────────────────────────────────────────────────────────────────
// "[01:23.45] text" -> { time: 83.45, text }. Blank lines are kept (instrumental
// gaps) so the previous line un-highlights instead of staying stuck.
export function parseSyncedLyrics(value) {
  if (!value) return []
  const lines = []
  const stamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g

  for (const raw of value.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(stamp)]
    if (!stamps.length) continue // skips [ar:], [ti:] and other tags
    const text = raw.replace(stamp, '').trim()
    for (const match of stamps) {
      const fraction = match[3] ? Number(`0.${match[3]}`) : 0
      lines.push({ time: Number(match[1]) * 60 + Number(match[2]) + fraction, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

// ── Network ───────────────────────────────────────────────────────────────────
// No custom headers on purpose: any non-standard header forces a CORS preflight
// that the browser can block.
async function lrclib(path, params, signal) {
  const query = params ? `?${new URLSearchParams(params)}` : ''
  const response = await fetch(`${LRCLIB_API}${path}${query}`, { signal })
  if (response.status === 404) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message || `Lyrics service error (${response.status}).`)
  return data
}

async function searchRecords(params, signal) {
  const data = await lrclib('/search', params, signal)
  const records = (Array.isArray(data) ? data : []).filter(
    (record) => !record.instrumental && parseSyncedLyrics(record.syncedLyrics).length > 0,
  )
  for (const record of records) if (record.id) recordCache.set(record.id, record)
  return records
}

// ── Track title cleanup ───────────────────────────────────────────────────────
// "Artist - Song (Official Video) ft. X" -> { title: "Song", artist: "Artist" }
export function parseTrackInfo(rawTitle = '', channel = '') {
  const cleaned = String(rawTitle)
    .replace(/[([][^)\]]*\b(?:official|video|lyrics?|audio|visuali[sz]er|remaster(?:ed)?|hd|4k|mv|m\/v|live|clip|version|performance)\b[^)\]]*[)\]]/gi, ' ')
    .replace(/\s*[-–—|]\s*(?:official\b.*|lyrics?\b.*|audio\b.*|music video\b.*|video\b.*)$/i, '')
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  let artist = String(channel)
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\bofficial\b/gi, '')
    .trim()
  let title = cleaned
  const parts = cleaned.split(/\s+[-–—|]\s+/)
  const fromTitle = parts.length >= 2
  if (fromTitle) {
    artist = parts[0].trim()
    title = parts.slice(1).join(' ').trim()
  }
  title = title.replace(/\s*[([]?\s*(?:feat\.?|ft\.?|featuring)\s[^)\]]*[)\]]?/i, '').trim()
  return { title: title || cleaned, artist, fromTitle }
}

// ── Matching ──────────────────────────────────────────────────────────────────
function scoreRecord(record, info, track) {
  const recTitle = normalize(record.trackName || record.name)
  const recArtist = normalize(record.artistName)
  const wantTitle = normalize(info.title)
  if (!recTitle || !wantTitle) return -1

  let score
  if (recTitle === wantTitle) score = 6
  else if (containsPhrase(recTitle, wantTitle) || containsPhrase(wantTitle, recTitle)) score = 3
  else return -1

  const wantArtist = normalize(info.artist)
  const recCompact = compact(recArtist)
  const wantCompact = compact(wantArtist).replace(/(vevo|topic|official)$/, '')
  const artistMatches =
    containsPhrase(wantArtist, recArtist) || containsPhrase(recArtist, wantArtist) ||
    containsPhrase(normalize(track.title), recArtist) ||
    (recCompact.length >= 3 && wantCompact.length >= 3 &&
      (recCompact.includes(wantCompact) || wantCompact.includes(recCompact)))
  if (artistMatches) score += 4

  if (track.duration && record.duration) {
    const diff = Math.abs(record.duration - track.duration)
    if (diff <= 3) score += 4
    else if (diff <= 8) score += 2
    else if (diff > 25) score -= 3
  }
  return score
}

function pickBest(records, info, track) {
  let best = null
  let bestScore = 6 // needs 7+: title match plus artist or duration agreement
  for (const record of records) {
    const score = scoreRecord(record, info, track)
    if (score > bestScore) { best = record; bestScore = score }
  }
  return best
}

async function lookup(track, signal) {
  const info = parseTrackInfo(track.title, track.artist)
  if (!info.title) return null

  const primary = [
    info.artist ? { track_name: info.title, artist_name: info.artist } : { track_name: info.title },
    { q: `${info.artist} ${info.title}`.trim() },
  ]
  for (const params of primary) {
    const best = pickBest(await searchRecords(params, signal), info, track)
    if (best) return best
  }

  // "Song - Artist" titles: try the two halves the other way round.
  if (info.fromTitle && info.artist) {
    const swapped = { title: info.artist, artist: info.title }
    const records = await searchRecords({ track_name: swapped.title, artist_name: swapped.artist }, signal)
    return pickBest(records, swapped, track)
  }
  return null
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function findLyricsForTrack(track, signal) {
  if (!track?.title) return null
  const key = track.id || `${track.title}|${track.artist}`
  if (resultCache.has(key)) return resultCache.get(key)
  const record = await lookup(track, signal)
  resultCache.set(key, record) // only reached on success, so errors are retried
  return record
}

export async function getSyncedLyrics(track, signal) {
  if (!track?.title) return null

  if (track.lyricsId) {
    if (recordCache.has(track.lyricsId)) return recordCache.get(track.lyricsId)
    const record = await lrclib(`/get/${encodeURIComponent(track.lyricsId)}`, null, signal)
    if (record && parseSyncedLyrics(record.syncedLyrics).length) {
      recordCache.set(track.lyricsId, record)
      return record
    }
  }
  return findLyricsForTrack(track, signal)
}

// ── Text helpers ──────────────────────────────────────────────────────────────
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((?:official|music video|lyric video|lyrics?|audio|visualizer|remaster(?:ed)?|hd|4k)[^)]*\)/g, ' ')
    .replace(/\[(?:official|music video|lyric video|lyrics?|audio|visualizer|remaster(?:ed)?|hd|4k)[^\]]*\]/g, ' ')
    .replace(/\b(?:official music video|official video|official audio|music video|lyric video|lyrics video|lyrics|audio|visualizer|remastered|remaster|4k|hd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compact(value) {
  return normalize(value).replace(/[^a-z0-9]/g, '')
}

function containsPhrase(haystack, phrase) {
  if (!haystack || !phrase) return false
  return ` ${haystack} `.includes(` ${phrase} `)
}