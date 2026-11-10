// src/pages/Explore.jsx
// Discover music by mood/genre — taps into YouTube search with curated queries.
import { useState } from 'react'
import { searchYouTube } from '../services/youtube'
import AddToPlaylist from '../components/AddToPlaylist'
import { Compass, Plus, Loader } from 'lucide-react'

const CATEGORIES = [
  { label: '🔥 Trending',       query: 'trending music 2024' },
  { label: '😌 Chill Vibes',    query: 'chill lo-fi study music' },
  { label: '🎉 Party',          query: 'best party hits playlist' },
  { label: '💪 Workout',        query: 'gym workout motivation music' },
  { label: '😢 Sad Hours',      query: 'sad songs playlist 2024' },
  { label: '🌅 Morning',        query: 'morning coffee playlist music' },
  { label: '🎸 Rock',           query: 'best rock songs playlist' },
  { label: '🎹 Classical',      query: 'relaxing classical music' },
  { label: '🌍 Afrobeats',      query: 'afrobeats hits 2024' },
  { label: '🎤 Hip-Hop',        query: 'hip hop hits 2024' },
  { label: '💃 K-Pop',          query: 'kpop hits 2024' },
  { label: '🎷 Jazz',           query: 'smooth jazz playlist' },
]

export default function Explore({ onAddToRoom }) {
  const [active, setActive]     = useState(null)
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

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

      <div className="category-grid">
        {CATEGORIES.map(cat => (
          <button
            key={cat.label}
            className={`category-chip${active?.label === cat.label ? ' active' : ''}`}
            onClick={() => pick(cat)}
          >
            {cat.label}
          </button>
        ))}
      </div>

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
                <img src={track.thumbnail} alt="" />
                <div className="track-text">
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </div>
                <AddToPlaylist track={track} />
                {onAddToRoom && (
                  <button className="icon-btn add-btn" onClick={() => onAddToRoom(track)} title="Add to current room">
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
