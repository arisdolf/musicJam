// Browse genres and popular tracks from YouTube.
import { useEffect, useState } from 'react'
import { getPopularMusic, searchPopularSongs } from '../services/youtube'
import AddToPlaylist from '../components/AddToPlaylist'
import FeedbackModal from '../components/FeedbackModal'
import { Compass, Plus, Loader, Flame, Headphones, PartyPopper, Dumbbell, Cloud, Sun, Guitar, Piano, Globe2, Mic2, Disc3, Waves, Eye, Music2 } from 'lucide-react'

const CATEGORIES = [
  { label: 'Trending', icon: Flame, query: 'trending music' },
  { label: 'Chill', icon: Headphones, query: 'chill lo-fi study music' },
  { label: 'Party', icon: PartyPopper, query: 'popular party hits playlist' },
  { label: 'Workout', icon: Dumbbell, query: 'workout motivation music' },
  { label: 'R&B', icon: Waves, query: 'popular r&b songs' },
  { label: 'Morning', icon: Sun, query: 'morning coffee playlist music' },
  { label: 'Rock', icon: Guitar, query: 'popular rock songs' },
  { label: 'Classical', icon: Piano, query: 'relaxing classical music' },
  { label: 'Afrobeats', icon: Globe2, query: 'popular afrobeats songs' },
  { label: 'Hip-Hop', icon: Mic2, query: 'popular hip hop songs' },
  { label: 'K-Pop', icon: Disc3, query: 'popular kpop songs' },
  { label: 'Jazz', icon: Cloud, query: 'smooth jazz playlist' },
]

export default function Explore({ onAddToRoom }) {
  const [active, setActive]     = useState(null)
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [feedback, setFeedback] = useState('')
  const [popular, setPopular]   = useState([])
  const [popularLoading, setPopularLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    getPopularMusic('PH', controller.signal)
      .then(setPopular)
      .catch((err) => { if (err.name !== 'AbortError') setFeedback(err.message) })
      .finally(() => { if (!controller.signal.aborted) setPopularLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!active) { setResults([]); setLoading(false); return undefined }
    const controller = new AbortController()
    setLoading(true)
    setResults([])
    searchPopularSongs(active.query, controller.signal)
      .then(setResults)
      .catch((err) => { if (err.name !== 'AbortError') setFeedback(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [active])

  const pick = (category) => {
    setFeedback('')
    setActive((current) => current?.label === category.label ? null : category)
  }

  const visibleTracks = active ? results : popular
  const visibleLoading = active ? loading : popularLoading

  return (
    <main className="explore-page">
      <div className="explore-header">
        <Compass size={22} />
        <div>
          <h1>Explore</h1>
          <p className="muted">Discover music by mood or genre.</p>
        </div>
      </div>

      <h2 className="section-label">Browse by mood or genre</h2>
      <div className="category-grid">
        {CATEGORIES.map(cat => (
          <button
            key={cat.label}
            className={`category-chip${active?.label === cat.label ? ' active' : ''}`}
            onClick={() => pick(cat)}
          >
            <cat.icon size={16} aria-hidden="true" />
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      <section className="popular-section" aria-labelledby="popular-title">
        <div className="popular-heading">
          <div><span className="eyebrow">{active ? 'TOP 25 · MOST VIEWED' : 'YOUTUBE MUSIC CHART'}</span><h2 id="popular-title">{active ? `Popular ${active.label} songs` : 'Popular in the Philippines'}</h2></div>
          <span className="popular-heading-icon">{active ? <active.icon size={18} /> : <Flame size={18} />}</span>
        </div>
        <p className="muted popular-subtitle">{active ? 'Ranked by views. Only playable music videos are shown.' : 'Songs people are watching right now.'}</p>
        {visibleLoading && <div className="explore-loading"><Loader size={18} className="spin" /> Finding playable songs…</div>}
        {!visibleLoading && visibleTracks.length > 0 && <ul className="track-list popular-track-list">
          {visibleTracks.map((track, index) => (
            <li className="track" key={track.id}>
              <span className="popular-rank">{String(index + 1).padStart(2, '0')}</span>
              <img src={track.thumbnail} alt="" loading="lazy" />
              <div className="track-text"><strong title={track.title}>{track.title}</strong><small>{track.artist}</small></div>
              <span className="popular-views" title="YouTube views"><Eye size={13} /> {formatViews(track.views)}</span>
              <AddToPlaylist track={track} />
              {onAddToRoom && <button className="icon-btn add-btn" onClick={() => onAddToRoom(track)} title="Add to current room" aria-label={`Add ${track.title} to current room`}><Plus size={17} /></button>}
            </li>
          ))}
        </ul>}
        {!visibleLoading && !visibleTracks.length && <div className="empty-result-card"><Music2 size={22} /><span>No playable songs found. Try another genre.</span></div>}
      </section>
      <FeedbackModal title="Could not load music" message={feedback} onClose={() => setFeedback('')} />
    </main>
  )
}

function formatViews(value = 0) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return value.toLocaleString()
}
