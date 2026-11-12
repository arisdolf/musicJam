// src/services/youtube.js
import { findLyricsForTrack } from './lyrics'

const API = 'https://www.googleapis.com/youtube/v3'
const REGION = 'PH'
const CACHE_TTL = 10 * 60 * 1000
const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
const cache = new Map()

export function searchYouTube(query, signal) {
  return searchMusic(query, { signal, limit: 8, order: 'relevance', requireSyncedLyrics: true })
}

export function searchPopularSongs(query, signal) {
  return searchMusic(query, { signal, limit: 25, order: 'viewCount', requireSyncedLyrics: true })
}

export function getPopularMusic(regionCode = REGION, signal) {
  return cached(`chart|${regionCode}`, async () => {
    try {
      const data = await yt('videos', {
        part: 'snippet,statistics,status,contentDetails', chart: 'mostPopular',
        regionCode, videoCategoryId: '10', maxResults: '25',
      }, signal)
      return (data.items || []).filter((item) => isPlayable(item, regionCode)).slice(0, 8).map(toTrack)
    } catch (error) {
      // Some regions have no music chart; fall back to the most viewed music videos.
      if (error.reason !== 'videoChartNotFound') throw error
      return searchMusic('top music hits', { signal, limit: 8, order: 'viewCount', requireSyncedLyrics: false })
    }
  })
}

// ── Core search ───────────────────────────────────────────────────────────────
function searchMusic(query, { signal, limit, order, requireSyncedLyrics }) {
  return cached(`${order}|${requireSyncedLyrics}|${query.toLowerCase()}`, async () => {
    const search = await yt('search', {
      part: 'snippet', type: 'video', videoCategoryId: '10',
      videoEmbeddable: 'true', videoSyndicated: 'true', regionCode: REGION,
      maxResults: order === 'viewCount' ? '50' : '25', order, q: query,
    }, signal)
    const ids = (search.items || []).map((item) => item.id?.videoId).filter(Boolean)
    if (!ids.length) return []

    // videos.list gives clean (un-escaped) titles, duration and view counts.
    const details = await yt('videos', {
      part: 'snippet,status,contentDetails,statistics', id: ids.join(','),
    }, signal)
    const byId = new Map((details.items || []).map((item) => [item.id, item]))
    const playable = ids
      .map((id) => byId.get(id))
      .filter((item) => item && isPlayable(item, REGION))
      .map(toTrack)

    if (!requireSyncedLyrics) return playable.slice(0, limit)
    return withLyrics(playable.slice(0, limit * 2), limit, signal)
  })
}

// Looks up lyrics per track (6 at a time) and keeps the first `limit` that have them.
async function withLyrics(candidates, limit, signal) {
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
async function yt(path, params, signal) {
  if (!apiKey) throw new Error('YouTube search needs a VITE_YOUTUBE_API_KEY in .env.')
  const response = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key: apiKey })}`, { signal })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason || data.error?.status || ''
    const error = new Error(friendlyError(reason, data.error?.message))
    error.reason = reason
    throw error
  }
  return data
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
    artist: snippet.channelTitle,
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