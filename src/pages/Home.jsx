import { useEffect, useState } from 'react'
import { Check, Flame, Loader, Play, Plus, RotateCw, Trash2} from 'lucide-react'
import HomeSearch from '../components/HomeSearch'
import LikeButton from '../components/LikeButton'
import { getTrending } from '../services/youtube'

export default function Home({ onPlaySong, onQueueTrack, onPlayTracks }) {
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
    <HomeSearch onPlaySong={onPlaySong} onQueueTrack={onQueueTrack} />

    <div className="block-head">
      <div>
        <span className="eyebrow"><Flame size={12} /> TRENDING IN THE PHILIPPINES</span>
        <h1>Top 25 songs</h1>
      </div>
      {tracks.length > 0 && <button className="btn btn-small btn-primary" onClick={() => onPlayTracks(tracks, 0)}>
        <Play size={14} fill="currentColor" /> Play all
      </button>}
    </div>

    {loading && <p className="message"><Loader size={14} className="spin" /> Loading trending songs…</p>}
    {!loading && error && <div className="empty-result-card">
      <span>{error}</span>
      <button className="btn btn-small" onClick={retry}><RotateCw size={14} /> Try again</button>
    </div>}

    {tracks.length > 0 && <ul className="track-list popular-track-list">
      {tracks.map((track, index) => {
        const queued = queuedIds.includes(track.id)
        return <li className="track" key={track.id}>
          <span className="popular-rank">{index + 1}</span>
          <img src={track.thumbnail} alt="" loading="lazy" />
          <button className="track-text as-button" onClick={() => onPlayTracks(tracks, index)}>
            <strong title={track.title}>{track.title}</strong><small>{track.artist}</small>
          </button>
          <div className="track-actions">
            <LikeButton track={track} />
            <button className="icon-btn" onClick={() => onPlayTracks(tracks, index)} aria-label={`Play ${track.title}`} title="Play now"><Play size={16} fill="currentColor" /></button>
            <button className="icon-btn add-btn" disabled={queued} onClick={(event) => queue(track, event.currentTarget)} aria-label={`Add ${track.title} to queue`} title={queued ? 'In queue' : 'Add to queue'}>
              {queued ? <Check size={16} /> : <Plus size={17} />}
            </button>
          </div>
        </li>
      })}
    </ul>}
  </main>
}