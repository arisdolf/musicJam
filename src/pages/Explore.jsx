// Browse genres and popular tracks from YouTube.
import { useEffect, useState } from 'react'
import { getPopularMusic, searchYouTube } from '../services/youtube'
import AddToPlaylist from '../components/AddToPlaylist'
import { Compass, Plus, Loader, Flame, Headphones, PartyPopper, Dumbbell, Cloud, Sun, Guitar, Piano, Globe2, Mic2, Disc3, Waves, Eye } from 'lucide-react'

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
  const [error, setError]       = useState('')
  const [popular, setPopular]   = useState([])
  const [popularError, setPopularError] = useState('')
  const [popularLoading, setPopularLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    getPopularMusic('PH', controller.signal)
      .then(setPopular)
      .catch((err) => { if (err.name !== 'AbortError') setPopularError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setPopularLoading(false) })
    return () => controller.abort()
  }, [])

  const pick = async (cat) => {
    if (active?.label === cat.label) { setActive(null); setResults([]); return }
    setActive(cat); setLoading(true); setError(''); setResults([])
    try {
      const tracks = await searchYouTube(cat.query)
      setResults(tracks)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

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
          <div><span className="eyebrow">YOUTUBE MUSIC CHART</span><h2 id="popular-title">Popular in the Philippines</h2></div>
          <span className="popular-heading-icon"><Flame size={18} /></span>
        </div>
        <p className="muted popular-subtitle">Songs people are watching right now.</p>
        {popularLoading && <div className="explore-loading"><Loader size={18} className="spin" /> Loading popular songs…</div>}
        {popularError && <p className="form-error" role="status">{popularError}</p>}
        {!popularLoading && popular.length > 0 && <ul className="track-list popular-track-list">
          {popular.map((track, index) => (
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
      </section>

      {loading && (
        <div className="explore-loading"><Loader size={20} className="spin" /> Loading…</div>
      )}
      {error && <p className="form-error">{error}</p>}

      {results.length > 0 && (
        <div className="explore-results">
          <h2 className="explore-results-title">{active?.label}</h2>
          <ul className="track-list">
            {results.map(track => (
              <li className="track" key={track.id}>
                <img src={track.thumbnail} alt="" loading="lazy" />
                <div className="track-text">
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </div>
                <AddToPlaylist track={track} />
                {onAddToRoom && (
                  <button className="icon-btn add-btn" onClick={() => onAddToRoom(track)} title="Add to current room" aria-label={`Add ${track.title} to current room`}>
                    <Plus size={17} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}

function formatViews(value = 0) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return value.toLocaleString()
}
