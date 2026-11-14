// src/services/youtube.js
import { findLyricsForTrack } from './lyrics'

const REGION = 'PH'
const CACHE_TTL = 10 * 60 * 1000
const KEYS = (import.meta.env.VITE_YOUTUBE_API_KEYS || import.meta.env.VITE_YOUTUBE_API_KEY || '')
  .split(',').map((key) => key.trim()).filter(Boolean)
// With no keys in the browser env the server picks the key, so we track it as one "Server key".
const KEY_COUNT = Math.max(KEYS.length, 1)
const QUOTA_REASONS = ['quotaExceeded', 'dailyLimitExceeded', 'RESOURCE_EXHAUSTED']

// ── Quota tracking (local to this browser) ────────────────────────────────────
export const QUOTA_LIMIT = 10000
const COSTS = { search: 100, videos: 1 }
const USAGE_KEY = 'jamroom:yt-usage'

// YouTube quotas reset at midnight Pacific time, so "exhausted" only lasts for that day.
const pacificDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())

function readUsage() {
  try {
    const saved = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null')
    return saved?.day === pacificDay() ? saved : { day: pacificDay(), used: {} }
  } catch { return { day: pacificDay(), used: {} } }
}

function writeUsage(usage) {
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(usage)) } catch { /* optional */ }
  window.dispatchEvent(new Event('jamroom:quota'))
}

function addUsage(index, cost) {
  const usage = readUsage()
  usage.used[index] = Math.min(QUOTA_LIMIT, (usage.used[index] || 0) + cost)
  writeUsage(usage)
}

function markFull(index) {
  const usage = readUsage()
  usage.used[index] = QUOTA_LIMIT
  writeUsage(usage)
}

export function quotaStatus() {
  const { used } = readUsage()
  return Array.from({ length: KEY_COUNT }, (_, i) => ({
    label: KEYS.length ? `Key ${i + 1}` : 'Server key',
    hint: KEYS[i] ? KEYS[i].slice(-4) : '',
    used: used[i] || 0,
    remaining: Math.max(0, QUOTA_LIMIT - (used[i] || 0)),
  }))
}

export function resetQuota() { writeUsage({ day: pacificDay(), used: {} }) }

// Quota resets at midnight Pacific time.
export function msUntilReset() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date())
  const get = (type) => Number(parts.find((p) => p.type === type).value) % 24
  return (86400 - (get('hour') * 3600 + get('minute') * 60 + get('second'))) * 1000
}

// First key that still has room and has not failed for this request. If every key looks full locally
// we still try the untried ones: the local counter is per browser, the real quota is shared.
function pickKey(tried) {
  const { used } = readUsage()
  const open = Array.from({ length: KEY_COUNT }, (_, i) => i).filter((i) => !tried.has(i))
  return open.find((i) => (used[i] || 0) < QUOTA_LIMIT) ?? open[0] ?? -1
}

const cache = new Map()

export function searchYouTube(query, signal) {
  return searchMusic(query, { signal, limit: 10, order: 'relevance' })
}

// ── Song vs. random video ─────────────────────────────────────────────────────
// Hard no: things that are clearly not a song.
const NOT_A_SONG = /\b(reaction|reacts?|reacting|review|tutorial|how to|lesson|karaoke|vlog|interview|behind the scenes|trailer|teaser|podcast|compilation|full album|shorts|dance practice|choreography|1 hour|2 hours|10 hours|nightcore|8d audio|asmr)\b/i
// Soft penalty: usually not the studio version.
const NOT_STUDIO = /\b(live|cover|slowed|sped up|reverb|concert|remix|acoustic version|instrumental)\b/i
const IS_AUDIO = /\b(official audio|audio|lyrics?|lyric video|visuali[sz]er)\b/i
const IS_VIDEO = /\b(official (music )?video|music video|m\/?v)\b/i

// Higher = more like a plain audio upload (e.g. "Artist - Topic" channels).
// Returns null when the item should be dropped.
function audioScore(item, seconds) {
  const title = item.snippet?.title || ''
  const channel = item.snippet?.channelTitle || ''
  if (NOT_A_SONG.test(title)) return null
  if (seconds < 60 || seconds > 720) return null

  let score = 0
  if (/\s-\s*topic$/i.test(channel)) score += 5
  if (IS_AUDIO.test(title)) score += 3
  if (IS_VIDEO.test(title)) score -= 3
  if (NOT_STUDIO.test(title)) score -= 2
  return score
}

// ── Core search ───────────────────────────────────────────────────────────────
function searchMusic(query, { signal, limit, order }) {
  return cached(`${order}|${query.toLowerCase()}`, async () => {
    const search = await yt('search', {
      part: 'snippet', type: 'video', videoCategoryId: '10',
      videoEmbeddable: 'true', videoSyndicated: 'true', regionCode: REGION,
      maxResults: '50', order, q: `${query} audio`,
    }, signal)
    const ids = (search.items || []).map((item) => item.id?.videoId).filter(Boolean)
    if (!ids.length) return []

    const details = await yt('videos', {
      part: 'snippet,status,contentDetails,statistics', id: ids.join(','),
    }, signal)
    const byId = new Map((details.items || []).map((item) => [item.id, item]))

    const scored = []
    ids.forEach((id, index) => {
      const item = byId.get(id)
      if (!item || !isPlayable(item, REGION)) return
      const track = toTrack(item)
      const score = audioScore(item, track.duration)
      if (score === null) return
      scored.push({ track, score, index })
    })

    // Audio uploads first, then keep YouTube's own order (relevance or views).
    scored.sort((a, b) => b.score - a.score || a.index - b.index)
    return scored.slice(0, limit).map((entry) => entry.track)
  })
}

// Looks up lyrics per track (6 at a time) and keeps the first `limit` that have them.
export async function withLyrics(candidates, limit, signal) {
  const found = new Array(candidates.length).fill(null)
  let next = 0, hits = 0, attempted = 0, failures = 0

  const worker = async () => {
    while (hits < limit) {
      const index = next++
      if (index >= candidates.length) return
      attempted++
      try {
        const record = await findLyricsForTrack(candidates[index], signal)
        if (record) { found[index] = record; hits++ }
      } catch (error) {
        if (error.name === 'AbortError') throw error
        failures++
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  if (!hits && attempted && failures === attempted) {
    throw new Error('Could not reach the lyrics service (LRCLIB). Check your connection and try again.')
  }
  return candidates
    .flatMap((track, index) => found[index] ? [{ ...track, lyricsId: found[index].id }] : [])
    .slice(0, limit)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Every request goes through the /api/youtube proxy. We tell it which key to use (keyIndex), count the
// cost once it succeeds, and when a key runs out we mark it full and retry on the next one.
async function yt(path, params, signal) {
  const cost = COSTS[path] ?? 1
  const tried = new Set()
  let failure = null

  for (;;) {
    const index = pickKey(tried)
    if (index < 0) throw failure
    tried.add(index)

    const query = new URLSearchParams({ path, ...params })
    if (KEYS.length) query.set('keyIndex', String(index))
    const response = await fetch(`/api/youtube?${query}`, { signal })
    const data = await response.json().catch(() => ({}))

    if (response.ok) { addUsage(index, cost); return data }

    const reason = data.error?.errors?.[0]?.reason || data.error?.status || ''
    const error = new Error(friendlyError(reason, data.error?.message))
    error.reason = reason
    if (!QUOTA_REASONS.includes(reason)) throw error
    markFull(index)
    failure = error
  }
}

function friendlyError(reason, fallback) {
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'RESOURCE_EXHAUSTED') {
    return 'YouTube daily quota reached. Try again tomorrow or use another API key.'
  }
  if (reason === 'keyInvalid' || reason === 'forbidden' || reason === 'PERMISSION_DENIED' || reason === 'INVALID_ARGUMENT') {
    return 'YouTube rejected the API key. Check VITE_YOUTUBE_API_KEY, that YouTube Data API v3 is enabled, and any key restrictions.'
  }
  return fallback || 'YouTube request failed.'
}

async function cached(key, load) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.value
  const value = await load()
  if (value.length) cache.set(key, { time: Date.now(), value })
  return value
}

function toTrack(item) {
  const { snippet, contentDetails, statistics } = item
  return {
    id: item.id,
    title: snippet.title,
    artist: snippet.channelTitle.replace(/\s*-\s*topic$/i, ''),
    thumbnail: snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
    duration: parseDuration(contentDetails?.duration),
    views: Number(statistics?.viewCount || 0),
  }
}

// "PT3M45S" -> 225
function parseDuration(iso = '') {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!match) return 0
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)
}

function isPlayable(item, regionCode) {
  return item.snippet?.categoryId === '10'
    && Boolean(item.status?.embeddable)
    && item.status?.privacyStatus === 'public'
    && isAvailableInRegion(item.contentDetails, regionCode)
}

function isAvailableInRegion(details, regionCode) {
  if (details?.contentRating?.ytRating === 'ytAgeRestricted') return false
  const restriction = details?.regionRestriction
  if (!restriction) return true
  if (restriction.blocked?.includes(regionCode)) return false
  if (restriction.allowed && !restriction.allowed.includes(regionCode)) return false
  return true
}

// Finds the best playable YouTube match for one imported song.
// Costs one search + one videos.list call. Returns null when nothing fits.
export async function matchSong({ title, artist, duration }, signal) {
  const q = `${artist} ${title}`.trim()
  const search = await yt('search', {
    part: 'snippet', type: 'video', videoCategoryId: '10',
    videoEmbeddable: 'true', videoSyndicated: 'true', regionCode: REGION,
    maxResults: '5', order: 'relevance', q,
  }, signal)
  const ids = (search.items || []).map((item) => item.id?.videoId).filter(Boolean)
  if (!ids.length) return null

  const details = await yt('videos', { part: 'snippet,status,contentDetails,statistics', id: ids.join(',') }, signal)
  const byId = new Map((details.items || []).map((item) => [item.id, item]))
  const wanted = title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)

  let best = null, bestScore = -Infinity
  ids.forEach((id, index) => {
    const item = byId.get(id)
    if (!item || !isPlayable(item, REGION)) return
    const track = toTrack(item)
    const haystack = track.title.toLowerCase()
    const titleHits = wanted.filter((word) => haystack.includes(word)).length
    let score = (wanted.length ? titleHits / wanted.length : 0) * 3 - index * 0.3
    if (duration && track.duration) {
      const diff = Math.abs(track.duration - duration)
      score += diff <= 5 ? 3 : diff <= 15 ? 1 : diff > 40 ? -3 : 0
    }
    if (score > bestScore) { best = track; bestScore = score }
  })
  return bestScore > 0 ? best : null
}
