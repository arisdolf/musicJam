import { useEffect, useMemo, useRef, useState } from 'react'
import { Flame, Play, RotateCw, Sparkles } from 'lucide-react'
import LikeButton from '../components/LikeButton'
import FeedTabs from '../components/FeedTabs'
import { HomeTrackSkeletonList } from '../components/Skeleton'
import { getTrending } from '../services/youtube'
import { GENRE_TABS, getForYou, getGenreFeed } from '../services/feeds'
import { getTaste } from '../utils/taste'
import TrackMenu from '../components/TrackMenu'

function loadFeed(tab, signal) {
  if (tab === 'trending') return getTrending(signal)
  if (tab === 'foryou') return getForYou(signal)
  return getGenreFeed(tab, signal)
}

export default function Home({ onQueueTrack, onPlayTracks }) {
  const [tab, setTab] = useState('trending')
  const [state, setState] = useState({ loading: true, tracks: [], error: '' })
  const [attempt, setAttempt] = useState(0)
  const [queuedIds, setQueuedIds] = useState([])
  const feeds = useRef(new Map()) // tabs already loaded this visit, so switching back is instant

  // "For you" appears once there is something to learn from. Genres you play most come first.
  const taste = useMemo(() => getTaste(), [])
  const tabs = useMemo(() => {
    const genres = [...GENRE_TABS].sort((a, b) => {
      const rank = (id) => { const i = taste.tags.indexOf(id); return i < 0 ? 99 : i }
      return rank(a.id) - rank(b.id)
    })
    return [
      { id: 'trending', label: 'Trending' },
      ...(taste.count > 0 ? [{ id: 'foryou', label: 'For you' }] : []),
      ...genres,
    ]
  }, [taste])
  const genre = GENRE_TABS.find((item) => item.id === tab)

  useEffect(() => {
    const hit = feeds.current.get(tab)
    if (hit) { setState({ loading: false, tracks: hit, error: '' }); return undefined }
    setState({ loading: true, tracks: [], error: '' })
    const controller = new AbortController()
    loadFeed(tab, controller.signal)
      .then((tracks) => {
        if (controller.signal.aborted) return
        if (tracks.length) feeds.current.set(tab, tracks)
        setState({ loading: false, tracks, error: tracks.length ? '' : 'Nothing to show here right now.' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setState({ loading: false, tracks: [], error: error.message || 'Could not load songs.' })
        }
      })
    return () => controller.abort()
  }, [tab, attempt])

  const retry = () => { feeds.current.delete(tab); setAttempt((n) => n + 1) }
  const queue = (track, trigger) => {
    onQueueTrack(track, trigger)
    setQueuedIds((ids) => ids.includes(track.id) ? ids : [...ids, track.id])
  }
  const { loading, tracks, error } = state

  const title = tab === 'trending' ? 'Top 25 songs' : tab === 'foryou' ? 'Made for you' : `${genre?.label || ''} songs`

  return <>
    <FeedTabs tabs={tabs} value={tab} onChange={setTab} />
    <main className="page home-page">
      <div className="block-head">
        <div>
          <h1>{title}</h1>
          <p className="home-chart-location">
            {tab === 'trending' && <><Flame size={14} /> Trending in the Philippines</>}
            {tab === 'foryou' && <><Sparkles size={14} /> Based on what you listen to most</>}
            {genre && <>{genre.about}</>}
          </p>
        </div>
        {tracks.length > 0 && <button className="btn btn-small btn-primary" onClick={() => onPlayTracks(tracks, 0)}>
          <Play size={14} fill="currentColor" /> Play all
        </button>}
      </div>

      {loading && <HomeTrackSkeletonList count={5} />}
      {!loading && error && <div className="empty-result-card">
        <span>{error}</span>
        <button className="btn btn-small" onClick={retry}><RotateCw size={14} /> Try again</button>
      </div>}

      {tracks.length > 0 && <ul className="track-list popular-track-list" key={tab}>
        {tracks.map((track, index) => <li className="track" key={track.id}>
          <span className="popular-rank">{index + 1}</span>
          <img src={track.thumbnail} alt="" loading="lazy" />
          <button className="track-text as-button" onClick={() => onPlayTracks(tracks, index)} title="Play now">
            <strong title={track.title}>{track.title}</strong><small>{track.artist}</small>
          </button>
          <div className="track-actions">
            <LikeButton track={track} />
            <TrackMenu
              track={track}
              onPlay={() => onPlayTracks(tracks, index)}
              onQueue={(trigger) => queue(track, trigger)}
              queued={queuedIds.includes(track.id)}
            />
          </div>
        </li>)}
      </ul>}
    </main>
  </>
}