import { useCallback, useEffect, useRef, useState } from 'react'
import { searchSongsPage } from '../services/youtube'

const IDLE = { query: '', status: 'idle', tracks: [], loadingMore: false, hasMore: false, error: '' }
const MAX_PER_ARTIST = 2   // per search, unless the artist is the one you searched for
const MIN_NEW_PER_LOAD = 8 // keep fetching pages until a load adds at least this many songs

const norm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const keyOf = (track) => `${norm(track.title)}|${norm(track.artist)}`
const freshSession = () => ({ token: '', seen: new Set(), counts: new Map(), reserve: [], controller: null, busy: false, query: '' })

// Mixes artists so one artist can't fill the list. If the search itself names an artist
// (e.g. "taylor swift"), that artist is exempt and keeps all of their songs.
function diversify(tracks, query, counts) {
  const q = norm(query)
  const requested = (artist) => {
    const a = norm(artist)
    return a.length >= 3 && q.length >= 3 && (q.includes(a) || a.includes(q))
  }
  const groups = new Map()
  for (const track of tracks) {
    const key = norm(track.artist)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(track)
  }
  const lists = [...groups.entries()].map(([key, list]) => {
    const room = requested(list[0].artist) ? list.length : Math.max(0, MAX_PER_ARTIST - (counts.get(key) || 0))
    return { key, keep: list.slice(0, room), extra: list.slice(room) }
  })
  const shown = []
  for (let i = 0; lists.some((entry) => i < entry.keep.length); i++) {
    for (const entry of lists) if (entry.keep[i]) shown.push(entry.keep[i])
  }
  return { shown, extras: lists.flatMap((entry) => entry.extra) }
}

export function useSongSearch(rawQuery, { minChars = 3, debounce = 300 } = {}) {
  const q = rawQuery.trim()
  const [state, setState] = useState(IDLE)
  const session = useRef(freshSession())

  const run = useCallback(async (s, query, first) => {
    if (s.busy) return
    s.busy = true
    if (!first) setState((prev) => ({ ...prev, loadingMore: true }))
    try {
      const added = []
      for (let tries = 0; tries < 3 && added.length < MIN_NEW_PER_LOAD; tries++) {
        const { tracks, nextPageToken } = await searchSongsPage(query, s.token, s.controller.signal)
        s.token = nextPageToken

        const fresh = []
        for (const track of tracks) {
          const key = keyOf(track)
          if (s.seen.has(key)) continue // same title + same artist is never shown twice
          s.seen.add(key)
          fresh.push(track)
        }
        const { shown, extras } = diversify(fresh, query, s.counts)
        for (const track of shown) {
          const key = norm(track.artist)
          s.counts.set(key, (s.counts.get(key) || 0) + 1)
        }
        s.reserve.push(...extras)
        added.push(...shown)

        if (!s.token) { added.push(...s.reserve.splice(0)); break } // last page: show what we held back
      }
      if (s.controller.signal.aborted) return
      setState((prev) => {
        const tracks = first ? added : [...prev.tracks, ...added]
        return {
          query, status: 'done', tracks, loadingMore: false, hasMore: Boolean(s.token),
          error: tracks.length ? '' : 'No songs found. Try another search.',
        }
      })
    } catch (error) {
      if (error.name === 'AbortError' || s.controller.signal.aborted) return
      setState((prev) => ({
        query, status: 'done', tracks: first ? [] : prev.tracks, loadingMore: false,
        hasMore: !first && Boolean(s.token), error: error.message || 'Search failed.',
      }))
    } finally { s.busy = false }
  }, [])

  useEffect(() => {
    const s = freshSession()
    s.controller = new AbortController()
    s.query = q
    session.current = s
    if (q.length < minChars) return () => s.controller.abort()
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, query: q, status: 'loading', error: '' })) // old results stay visible
      run(s, q, true)
    }, debounce)
    return () => { clearTimeout(timer); s.controller.abort() }
  }, [q, minChars, debounce, run])

  const loadMore = useCallback(() => {
    const s = session.current
    if (!s.token || s.busy) return
    run(s, s.query, false)
  }, [run])

  const waiting = q.length >= minChars && (state.query !== q || state.status === 'loading')
  return { ...state, q, waiting, loadMore }
}