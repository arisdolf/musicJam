const LRCLIB_API = 'https://lrclib.net/api'
const lyricsCache = new Map()

function clientHeaders() {
  const origin = typeof window === 'undefined' ? '' : ` (${window.location.origin})`
  return {
    Accept: 'application/json',
    'X-User-Agent': `Jamroom/${import.meta.env.VITE_APP_VERSION || '0.0.0'}${origin}`,
  }
}

export function parseSyncedLyrics(value) {
  if (!value) return []
  const lines = []
  const timestampPattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

  for (const rawLine of value.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(timestampPattern)]
    const text = rawLine.replace(timestampPattern, '').trim()
    if (!text) continue

    for (const match of timestamps) {
      const fraction = match[3] ? Number(`0.${match[3]}`) : 0
      lines.push({
        time: Number(match[1]) * 60 + Number(match[2]) + fraction,
        text,
      })
    }
  }

  return lines.sort((a, b) => a.time - b.time)
}

export async function searchSyncedLyrics(query, signal) {
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`${LRCLIB_API}/search?${params}`, { signal, headers: clientHeaders() })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message || `Lyrics search failed (${response.status}).`)

  return (Array.isArray(data) ? data : []).filter((record) => {
    const hasTimedLines = parseSyncedLyrics(record.syncedLyrics).length > 0
    if (hasTimedLines && record.id) lyricsCache.set(record.id, record)
    return hasTimedLines
  })
}

export function findLyricsMatch(track, records) {
  return records.find((record) => matchesTrack(record, track)) || null
}

export async function getSyncedLyrics(track, signal) {
  if (track?.lyricsId && lyricsCache.has(track.lyricsId)) return lyricsCache.get(track.lyricsId)

  if (track?.lyricsId) {
    const response = await fetch(`${LRCLIB_API}/get/${encodeURIComponent(track.lyricsId)}`, { signal, headers: clientHeaders() })
    const record = await response.json().catch(() => null)
    if (!response.ok) throw new Error(record?.message || `Could not load lyrics (${response.status}).`)
    if (parseSyncedLyrics(record?.syncedLyrics).length) {
      lyricsCache.set(track.lyricsId, record)
      return record
    }
    return null
  }

  if (!track?.title) return null
  const records = await searchSyncedLyrics(`${track.title} ${track.artist || ''}`.trim(), signal)
  return findLyricsMatch(track, records)
}

function matchesTrack(record, track) {
  const videoTitle = normalize(track?.title)
  const lyricTitle = normalize(record?.trackName || record?.name)
  const lyricArtist = normalize(record?.artistName)
  if (!videoTitle || !lyricTitle || !lyricArtist || !containsPhrase(videoTitle, lyricTitle)) return false

  const videoArtist = normalize(track?.artist)
  const artistInVideoTitle = containsPhrase(videoTitle, lyricArtist)
  const artistInChannel = containsPhrase(videoArtist, lyricArtist)
  const artistCompact = compact(lyricArtist)
  const channelCompact = compact(videoArtist).replace(/(vevo|topic|official)$/i, '')
  const artistCompactMatch = artistCompact.length >= 3 && channelCompact.length >= 3
    && (artistCompact === channelCompact || artistCompact.includes(channelCompact) || channelCompact.includes(artistCompact))

  return artistInVideoTitle || artistInChannel || artistCompactMatch
}

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
