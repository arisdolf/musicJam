import { useCallback, useEffect, useState } from 'react'
import { Music2, Play, RotateCw } from 'lucide-react'
import LikeButton from './LikeButton'
import { Skeleton } from './Skeleton'
import TrackMenu from './TrackMenu'
import { filterKnownSongs } from '../utils/knownSongs'

function AlbumCard({ track, tracks, index, currentTrack, isPlaying, queued, onQueueTrack, onPlayTracks }) {
  const isCurrent = currentTrack?.id === track.id
  return <li className={`home-album-card${isCurrent ? ' is-current' : ''}`}>
    <button className="home-album-cover" type="button" onClick={() => onPlayTracks(tracks, index)} aria-label={`Play ${track.title} by ${track.artist}`}>
      {track.thumbnail
        ? <img src={track.thumbnail} alt="" loading="lazy" decoding="async" />
        : <span className="home-album-placeholder"><Music2 size={28} /></span>}
      <span className="home-album-play"><Play size={17} fill="currentColor" /></span>
      {isCurrent && isPlaying && <span className="home-album-live">Now playing</span>}
    </button>
    <button className="home-album-copy" type="button" onClick={() => onPlayTracks(tracks, index)} title={`Play ${track.title}`}>
      <strong>{track.title}</strong><small>{track.artist}</small>
    </button>
    <div className="home-album-actions">
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

function AlbumSkeletons({ title, loading }) {
  const cards = <ul className="home-album-rail" aria-hidden={!loading || undefined}>
    {Array.from({ length: 5 }, (_, index) => <li className="home-album-skeleton" key={index} aria-hidden="true">
      <Skeleton className="home-album-skeleton-cover" />
      <Skeleton className="home-album-skeleton-title" />
      <Skeleton className="home-album-skeleton-artist" />
    </li>)}
  </ul>
  return loading ? <div role="status" aria-label={`Loading ${title} songs`}>{cards}</div> : cards
}

export default function HomeShelf({ id, title, description, icon, load, currentTrack, isPlaying, queuedIds, onQueueTrack, onPlayTracks }) {
  const [target, setTarget] = useState(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'idle', tracks: [], error: '' })
  const headingId = `home-shelf-${id}`

  useEffect(() => {
    if (!target || nearViewport) return undefined
    if (!('IntersectionObserver' in window)) { setNearViewport(true); return undefined }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setNearViewport(true)
      observer.disconnect()
    }, { rootMargin: '380px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [target, nearViewport])

  useEffect(() => {
    if (!nearViewport) return undefined
    const controller = new AbortController()
    setState({ status: 'loading', tracks: [], error: '' })
    load(controller.signal)
      .then((tracks) => {
        if (!controller.signal.aborted) setState({ status: 'ready', tracks: filterKnownSongs(tracks), error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setState({ status: 'error', tracks: [], error: error.message || `Could not load ${title} songs.` })
        }
      })
    return () => controller.abort()
  }, [load, nearViewport, attempt, title])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return <section className="home-shelf" ref={setTarget} aria-labelledby={headingId} aria-busy={state.status === 'loading'}>
    <div className="home-section-heading">
      <div>
        <h2 id={headingId}>{icon}{title}</h2>
        <p>{description}</p>
      </div>
    </div>
    {state.status === 'idle' || state.status === 'loading'
      ? <AlbumSkeletons title={title} loading={state.status === 'loading'} />
      : state.status === 'error'
        ? <div className="home-shelf-message" role="alert">
          <p>{state.error}</p>
          <button className="btn btn-small" type="button" onClick={retry}><RotateCw size={14} /> Try again</button>
        </div>
        : state.tracks.length === 0
          ? <p className="home-shelf-empty">No songs found in {title} right now.</p>
          : <ul className="home-album-rail" aria-label={`${title} songs`}>
            {state.tracks.map((track, index) => <AlbumCard
              key={track.id}
              track={track}
              tracks={state.tracks}
              index={index}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              queued={queuedIds.has(track.id)}
              onQueueTrack={onQueueTrack}
              onPlayTracks={onPlayTracks}
            />)}
          </ul>}
  </section>
}
