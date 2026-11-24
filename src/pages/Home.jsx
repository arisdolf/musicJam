import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flame, Headphones, Music2, Play, RotateCw, Sparkles } from 'lucide-react'
import LikeButton from '../components/LikeButton'
import HomeShelf from '../components/HomeShelf'
import { HomeTrackSkeletonList } from '../components/Skeleton'
import { getTrending } from '../services/youtube'
import { GENRE_TABS, getForYou, getGenreFeed } from '../services/feeds'
import { getTaste } from '../utils/taste'
import TrackMenu from '../components/TrackMenu'
import { filterKnownSongs } from '../utils/knownSongs'

function GenreShelf({ genre, ...props }) {
  const load = useCallback((signal) => getGenreFeed(genre.id, signal), [genre.id])
  return <HomeShelf id={genre.id} title={genre.label} description={genre.about} load={load} {...props} />
}

function TrendingTrack({ track, index, tracks, currentTrack, isPlaying, queued, onQueueTrack, onPlayTracks }) {
  const isCurrent = currentTrack?.id === track.id
  return <li className={`home-trending-track${isCurrent ? ' is-current' : ''}`} aria-current={isCurrent ? 'true' : undefined}>
    <span className="home-trending-rank" aria-label={`Rank ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
    <button className="home-trending-cover" type="button" onClick={() => onPlayTracks(tracks, index)} aria-label={`Play ${track.title} by ${track.artist}`}>
      {track.thumbnail && <img src={track.thumbnail} alt="" loading="lazy" decoding="async" />}
      <span className="home-trending-play"><Play size={14} fill="currentColor" /></span>
    </button>
    <button className="home-trending-copy" type="button" onClick={() => onPlayTracks(tracks, index)} title={`Play ${track.title}`}>
      <strong>{track.title}</strong><small>{track.artist}</small>
      {isCurrent && <span className="home-trending-status">{isPlaying ? 'Now playing' : 'Paused'}</span>}
    </button>
    <div className="home-trending-actions">
      <LikeButton track={track} />
      <TrackMenu
        track={track}
        onPlay={() => onPlayTracks(tracks, index)}
        onQueue={(trigger) => onQueueTrack(track, trigger)}
        queued={queued}
      />
    </div>
  </li>
}

export default function Home({ user, currentTrack, isPlaying, onOpenJamRoom, onQueueTrack, onPlayTracks }) {
  const [trending, setTrending] = useState({ status: 'loading', tracks: [], error: '' })
  const [attempt, setAttempt] = useState(0)
  const [showAllTrending, setShowAllTrending] = useState(false)
  const [queuedIds, setQueuedIds] = useState(() => new Set())

  // "For you" appears once there is something to learn from. Genres you play most come first.
  const [taste, setTaste] = useState(getTaste)
  useEffect(() => {
    const refreshTaste = () => setTaste(getTaste())
    window.addEventListener('jamroom:taste', refreshTaste)
    return () => window.removeEventListener('jamroom:taste', refreshTaste)
  }, [])
  const genres = useMemo(() => [...GENRE_TABS].sort((a, b) => {
    const rank = (id) => { const i = taste.tags.indexOf(id); return i < 0 ? 99 : i }
    return rank(a.id) - rank(b.id)
  }), [taste])
  const loadForYou = useCallback((signal) => getForYou(signal), [])

  useEffect(() => {
    const controller = new AbortController()
    setTrending({ status: 'loading', tracks: [], error: '' })
    getTrending(controller.signal)
      .then((tracks) => {
        if (!controller.signal.aborted) setTrending({ status: 'ready', tracks: filterKnownSongs(tracks), error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setTrending({ status: 'error', tracks: [], error: error.message || 'Could not load trending songs.' })
        }
      })
    return () => controller.abort()
  }, [attempt])

  const queueTrack = useCallback((track, trigger) => {
    onQueueTrack(track, trigger)
    setQueuedIds((ids) => {
      if (ids.has(track.id)) return ids
      const next = new Set(ids)
      next.add(track.id)
      return next
    })
  }, [onQueueTrack])

  const visibleTrending = showAllTrending ? trending.tracks : trending.tracks.slice(0, 8)
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'
  const playbackLabel = currentTrack ? (isPlaying ? 'Playing' : 'Paused') : 'Ready to play'

  return <main className="page home-page">
    <header className="home-intro">
      <div className="home-intro-copy">
        <h1>{user ? `Welcome back, ${firstName}.` : 'Find your next favorite.'}</h1>
        <p>Explore popular songs and sounds for every mood.</p>
      </div>
      <div className="home-statuses">
        <div className={`home-playback-state${currentTrack ? (isPlaying ? ' is-playing' : ' is-paused') : ' is-idle'}`} aria-live="polite">
          {currentTrack?.thumbnail
            ? <img src={currentTrack.thumbnail} alt="" loading="lazy" decoding="async" />
            : <span className="home-status-icon"><Music2 size={16} /></span>}
          <span className="home-status-copy">
            <small>{currentTrack ? (isPlaying ? 'Now playing' : 'Paused') : 'Playback'}</small>
            <strong>{currentTrack?.title || playbackLabel}</strong>
            {currentTrack?.artist && <small>{currentTrack.artist}</small>}
          </span>
          {currentTrack && isPlaying && <span className="home-playing-bars" aria-hidden="true"><i /><i /><i /></span>}
        </div>
      </div>
    </header>

    <section className={`home-room-banner${currentTrack && isPlaying ? ' is-playing' : ''}`} aria-labelledby="home-room-banner-title">
      <div className="home-room-banner-copy">
        <h2 id="home-room-banner-title">Listen together.</h2>
        <p>Start a room, share a code, and queue up songs with friends.</p>
        <button className="btn btn-primary home-room-banner-cta" type="button" onClick={onOpenJamRoom}>
          <Headphones size={16} /> Start a room
        </button>
      </div>
      <div className="home-room-banner-art" aria-hidden="true">
        <div className="home-room-banner-signal home-room-banner-signal-one" />
        <div className="home-room-banner-signal home-room-banner-signal-two" />
        <div className="home-room-banner-record" />
        <div className="home-room-banner-equalizer"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      </div>
    </section>

    <div className="home-content-grid">
      <section className="home-trending-column" aria-labelledby="home-trending-title">
        <div className="home-section-heading home-trending-heading">
          <div>
            <h2 id="home-trending-title"><Flame size={18} /> Trending in the Philippines</h2>
            <p>Popular songs to start with.</p>
          </div>
          {trending.status === 'ready' && trending.tracks.length > 0 && <button className="btn btn-small btn-primary" type="button" onClick={() => onPlayTracks(trending.tracks, 0)}>
            <Play size={14} fill="currentColor" /> Play all
          </button>}
        </div>

        {trending.status === 'loading' && <HomeTrackSkeletonList count={6} />}
        {trending.status === 'error' && <div className="home-feed-error" role="alert">
          <p>{trending.error}</p>
          <button className="btn btn-small" type="button" onClick={() => setAttempt((value) => value + 1)}><RotateCw size={14} /> Try again</button>
        </div>}
        {trending.status === 'ready' && trending.tracks.length === 0 && <p className="home-feed-empty">No trending songs right now. Try again in a moment.</p>}
        {trending.status === 'ready' && trending.tracks.length > 0 && <>
          <ol className="home-trending-list">
            {visibleTrending.map((track, index) => <TrendingTrack
              key={track.id}
              track={track}
              index={index}
              tracks={trending.tracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              queued={queuedIds.has(track.id)}
              onQueueTrack={queueTrack}
              onPlayTracks={onPlayTracks}
            />)}
          </ol>
          {trending.tracks.length > 8 && <button className="home-trending-toggle" type="button" aria-expanded={showAllTrending} onClick={() => setShowAllTrending((value) => !value)}>
            {showAllTrending ? 'Show fewer' : `Show all ${trending.tracks.length} songs`}
          </button>}
        </>}
      </section>

      <div className="home-shelves">
        {taste.count > 0 && <HomeShelf
          id="for-you"
          title="Made for you"
          description="Songs shaped by what you listen to."
          icon={<Sparkles size={17} />}
          load={loadForYou}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          queuedIds={queuedIds}
          onQueueTrack={queueTrack}
          onPlayTracks={onPlayTracks}
        />}
        {genres.map((genre) => <GenreShelf
          key={genre.id}
          genre={genre}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          queuedIds={queuedIds}
          onQueueTrack={queueTrack}
          onPlayTracks={onPlayTracks}
        />)}
      </div>
    </div>
  </main>
}
