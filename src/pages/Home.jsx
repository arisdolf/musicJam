import { useEffect, useState } from 'react'
import { Flame, Play, RotateCw } from 'lucide-react'
import LikeButton from '../components/LikeButton'
import { HomeTrackSkeletonList } from '../components/Skeleton'
import { getTrending } from '../services/youtube'
import TrackMenu from '../components/TrackMenu'

export default function Home({ onQueueTrack, onPlayTracks }) {
  const [state, setState] = useState({ loading: true, tracks: [], error: '' })
  const [attempt, setAttempt] = useState(0)
  const [queuedIds, setQueuedIds] = useState([])

  useEffect(() => {
    const controller = new AbortController()
    getTrending(controller.signal)
      .then((tracks) => {
        if (!controller.signal.aborted) setState({ loading: false, tracks, error: tracks.length ? '' : 'No trending songs right now.' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setState({ loading: false, tracks: [], error: error.message || 'Could not load trending songs.' })
        }
      })
    return () => controller.abort()
  }, [attempt])

  const retry = () => { setState({ loading: true, tracks: [], error: '' }); setAttempt((n) => n + 1) }
  const queue = (track, trigger) => {
    onQueueTrack(track, trigger)
    setQueuedIds((ids) => ids.includes(track.id) ? ids : [...ids, track.id])
  }
  const { loading, tracks, error } = state

  return <main className="page home-page">
    <div className="block-head">
      <div>
        <h1>Top 25 songs</h1>
        <p className="home-chart-location"><Flame size={14} /> Trending in the Philippines</p>
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

    {tracks.length > 0 && <ul className="track-list popular-track-list">
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
}