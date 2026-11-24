import { searchMusic, getSimilarTracks } from './youtube'
import { getTaste } from '../utils/taste'

export const GENRE_TABS = [
  { id: 'pop',    label: 'Pop',     about: 'Big pop hits',                  queries: ['pop hits', 'top pop songs'] },
  { id: 'pinoy',  label: 'Pinoy',   about: 'OPM and Tagalog favorites',     queries: ['OPM hits', 'Tagalog love songs'], extra: { relevanceLanguage: 'tl' } },
  { id: 'gloomy', label: 'Gloomy',  about: 'Sad songs and heartbreak',      queries: ['sad songs', 'heartbreak songs'] },
  { id: 'chill',  label: 'Chill',   about: 'Calm, acoustic and easy',       queries: ['chill acoustic songs', 'relaxing songs'] },
  { id: 'love',   label: 'Love',    about: 'Songs for the romantics',       queries: ['love songs', 'romantic songs'] },
  { id: 'party',  label: 'Party',   about: 'Upbeat and dance hits',         queries: ['party dance hits', 'upbeat songs'] },
  { id: 'hiphop', label: 'Hip hop', about: 'Rap and hip hop',               queries: ['hip hop hits', 'rap songs'] },
  { id: 'rnb',    label: 'R&B',     about: 'Smooth R&B',                    queries: ['R&B songs', 'rnb hits'] },
  { id: 'rock',   label: 'Rock',    about: 'Rock and alternative',          queries: ['rock hits', 'alternative rock songs'] },
  { id: 'kpop',   label: 'K-pop',   about: 'Korean pop',                    queries: ['kpop hits', 'korean songs'] },
]

const FEED_TTL = 3 * 60 * 60 * 1000 // 3 hours: a feed costs ~100 quota units per query
const norm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Saved in the browser so a reload or tab switch is free.
async function feedCached(key, load) {
  const storageKey = `jamroom:feed:v1:${key}`
  try {
    const hit = JSON.parse(localStorage.getItem(storageKey) || 'null')
    if (hit && Date.now() - hit.at < FEED_TTL && hit.tracks?.length) return hit.tracks
  } catch { /* ignore */ }
  const tracks = await load()
  if (tracks.length) {
    try { localStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), tracks })) } catch { /* optional */ }
  }
  return tracks
}

// One track from each list in turn, so no single source fills the top of the feed.
function interleave(lists) {
  const out = []
  for (let i = 0; lists.some((list) => i < list.length); i++) {
    for (const list of lists) if (list[i]) out.push(list[i])
  }
  return out
}

// No repeated title + artist, at most `perArtist` songs per artist, nothing in `skip`.
function tidy(tracks, { perArtist = 3, limit = 30, skip = new Set() } = {}) {
  const seen = new Set()
  const counts = new Map()
  const out = []
  for (const track of tracks) {
    if (!track?.id || skip.has(track.id)) continue
    const key = `${norm(track.title)}|${norm(track.artist)}`
    if (seen.has(key)) continue
    const artist = norm(track.artist)
    if ((counts.get(artist) || 0) >= perArtist) continue
    seen.add(key)
    counts.set(artist, (counts.get(artist) || 0) + 1)
    out.push(track)
    if (out.length >= limit) break
  }
  return out
}

export function getGenreFeed(id, signal) {
  const tab = GENRE_TABS.find((item) => item.id === id)
  if (!tab) return Promise.resolve([])
  return feedCached(`genre|${id}`, async () => {
    const lists = await Promise.all(tab.queries.map((query) =>
      searchMusic(query, { signal, limit: 25, order: 'relevance', extra: tab.extra || {} })))
    return tidy(interleave(lists))
  })
}

// "For you" mixes four sources, then drops what you just played:
//  1. songs by your top artists (most played lately, older plays count less)
//  2. songs similar to the last song you played
//  3. your strongest vibe (e.g. gloomy or pinoy) from the genre list
export async function getForYou(signal) {
  const taste = getTaste()
  if (!taste.count) return []

  const list = await feedCached(`foryou|${taste.signature}`, async () => {
    const jobs = taste.artists.map((name) => searchMusic(`${name} songs`, { signal, limit: 20, order: 'relevance' }))
    if (taste.seed) jobs.push(getSimilarTracks(taste.seed, signal))
    const vibe = GENRE_TABS.find((tab) => tab.id === taste.tags[0])
    if (vibe) jobs.push(searchMusic(vibe.queries[0], { signal, limit: 20, order: 'relevance', extra: vibe.extra || {} }))

    const settled = await Promise.allSettled(jobs)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const lists = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    if (!lists.length) throw settled.find((r) => r.status === 'rejected')?.reason || new Error('Could not build your feed.')
    return tidy(interleave(lists), { limit: 40 })
  })

  const playedIds = new Set(taste.playedIds)
  const playedKeys = new Set(taste.playedKeys)
  return tidy(list.filter((track) =>
    !playedIds.has(track.id) && !playedKeys.has(`${norm(track.title)}|${norm(track.artist)}`),
  ), { limit: 30 })
}
