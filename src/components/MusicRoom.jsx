import { useEffect, useRef, useState } from 'react'
import { searchYouTube } from '../services/youtube'
import AddToPlaylist from './AddToPlaylist'
import { useAccount } from '../features/account/AccountContext'
import { Play, Pause, SkipForward, Search, Music2, Check, X, Plus } from 'lucide-react'

export default function MusicRoom({ roomCode, room, updateRoom, connection, members, onLeave }) {
  const { user, openAuth, createPlaylist } = useAccount()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const playerRef = useRef(null)
  const roomRef = useRef(room)
  const currentTrack = room.queue[room.current] || null
  const currentTrackId = currentTrack?.id

  useEffect(() => { roomRef.current = room }, [room])

  useEffect(() => {
    const createPlayer = () => {
      if (!window.YT?.Player || playerRef.current) return
      playerRef.current = new window.YT.Player('youtube-player', {
        playerVars: { origin: window.location.origin, playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            setPlayerReady(true)
            if (roomRef.current.playing) playerRef.current.playVideo()
          },
          onStateChange: (event) => {
            if (event.data === 1 && !roomRef.current.playing) updateRoom((state) => ({ ...state, playing: true }))
            if (event.data === 2 && roomRef.current.playing) updateRoom((state) => ({ ...state, playing: false }))
            if (event.data === 0) updateRoom((state) => state.queue.length > 1
              ? { ...state, current: (state.current + 1) % state.queue.length, playing: true }
              : { ...state, playing: false })
          },
        },
      })
    }
    if (window.YT?.Player) createPlayer()
    else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
      const previousCallback = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { previousCallback?.(); createPlayer() }
    }
    return () => { playerRef.current?.destroy?.(); playerRef.current = null }
  }, [updateRoom])

  useEffect(() => {
    if (!playerReady || !playerRef.current || !currentTrackId) return
    const player = playerRef.current
    if (player.getVideoData?.().video_id !== currentTrackId) {
      if (room.playing) player.loadVideoById(currentTrackId)
      else player.cueVideoById(currentTrackId)
    }
  }, [currentTrackId, room.playing, playerReady])

  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || !player || !currentTrackId) return
    if (room.playing) player.playVideo()
    else player.pauseVideo()
  }, [room.playing, currentTrackId, playerReady])

  useEffect(() => {
    if (!query.trim()) return undefined
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const tracks = await searchYouTube(query.trim(), controller.signal)
        setResults(tracks)
        setSearchError(tracks.length ? '' : 'No songs found. Try another search.')
      } catch (error) {
        if (error.name !== 'AbortError') setSearchError(error.message)
      } finally { setSearching(false) }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const addTrack = (track) => updateRoom((state) => {
    if (state.queue.some((item) => item.id === track.id)) return state
    const queue = [...state.queue, track]
    return { ...state, queue, current: state.queue.length === 0 ? 0 : state.current }
  })
  const playTrack = (index) => updateRoom((state) => ({ ...state, current: index, playing: true }))
  const removeTrack = (index) => updateRoom((state) => {
    const queue = state.queue.filter((_, itemIndex) => itemIndex !== index)
    const current = queue.length ? Math.min(state.current > index ? state.current - 1 : state.current, queue.length - 1) : 0
    return { ...state, queue, current, playing: queue.length ? state.playing : false }
  })
  const nextTrack = () => updateRoom((state) => state.queue.length < 2 ? { ...state, playing: false } : { ...state, current: (state.current + 1) % state.queue.length, playing: true })
  const togglePlay = () => updateRoom((state) => ({ ...state, playing: !state.playing }))

  const shareCode = async () => {
    try { await navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 1600) }
    catch { window.prompt('Share this room code:', roomCode) }
  }

  const saveQueue = async () => {
    if (!user) { openAuth('signup'); return }
    const name = window.prompt('Name this playlist', 'My playlist')
    if (!name?.trim()) return
    try { await createPlaylist(name, room.queue); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch (error) { window.alert(error.message || 'Could not save playlist.') }
  }

  const status = connection === 'connected' ? 'Live' : connection === 'local' ? 'Offline' : 'Connecting'

  return <main className="page room">
    <div className="room-bar">
      <button className="btn btn-text" onClick={onLeave}><X size={15} /> Leave</button>
      <div className="room-meta">
        <span className={`dot dot-${connection}`} aria-hidden="true" />
        <span>{status} · {members} {members === 1 ? 'listener' : 'listeners'}</span>
        <button className="chip" onClick={shareCode} title="Copy room code">{copied ? <><Check size={13} /> Copied</> : roomCode}</button>
      </div>
    </div>

    <section className="player" aria-label="Music player">
      <div className="video">
        <div id="youtube-player" />
        {!currentTrack && <div className="video-empty"><span><Music2 size={30} /></span><p>Add a song to get started</p></div>}
      </div>
      <div className="now">
        <div className="now-text">
          <h2>{currentTrack ? currentTrack.title : 'Nothing playing'}</h2>
          <p>{currentTrack ? currentTrack.artist : 'Search for a song below.'}</p>
        </div>
        <div className="controls">
          <button className="play-btn" aria-label={room.playing ? 'Pause' : 'Play'} onClick={togglePlay} disabled={!currentTrack}>{room.playing ? <Pause size={18} /> : <Play size={18} />}</button>
          <button className="icon-btn" aria-label="Next song" onClick={nextTrack} disabled={!currentTrack}><SkipForward size={17} /></button>
          {currentTrack && <AddToPlaylist track={currentTrack} />}
        </div>
      </div>
    </section>

    <section className="block">
      <h2><Search size={17} /> Add a song</h2>
      <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs or artists" aria-label="Search songs or artists" />
      {query && <div className="results">
        {searching ? <p className="message">Searching…</p>
          : searchError ? <p className="message">{searchError}</p>
          : results.map((track) => <div className="track" key={track.id}>
              <img src={track.thumbnail} alt="" />
              <div className="track-text"><strong>{track.title}</strong><small>{track.artist}</small></div>
              <AddToPlaylist track={track} />
              <button className="icon-btn add-btn" onClick={() => addTrack(track)} aria-label={`Add ${track.title} to queue`} title="Add to queue"><Plus size={17} /></button>
            </div>)}
      </div>}
    </section>

    <section className="block">
      <div className="block-head">
        <h2>Up next <small className="muted">{room.queue.length} {room.queue.length === 1 ? 'song' : 'songs'}</small></h2>
        {room.queue.length > 0 && <button className="btn btn-small" onClick={saveQueue}>{saved ? <><Check size={14} /> Saved</> : <><Music2 size={14} /> Save as playlist</>}</button>}
      </div>
      {room.queue.length === 0
        ? <p className="empty">Songs you add will show up here.</p>
        : <ul className="track-list">
            {room.queue.map((track, index) => <li className={`track ${index === room.current ? 'active' : ''}`} key={`${track.id}-${index}`}>
              <button className="track-play" onClick={() => playTrack(index)} aria-label={`Play ${track.title}`}>{index === room.current && room.playing ? <Pause size={12} /> : <Play size={12} />}</button>
              <img src={track.thumbnail} alt="" />
              <button className="track-text as-button" onClick={() => playTrack(index)}><strong>{track.title}</strong><small>{track.artist}</small></button>
              <AddToPlaylist track={track} />
              <button className="icon-btn" aria-label={`Remove ${track.title}`} onClick={() => removeTrack(index)}><X size={16} /></button>
            </li>)}
          </ul>}
    </section>

    {connection === 'local' && <p className="notice">Room server is offline, so this room only works in tabs on this device. Start the room server to sync with other devices.</p>}
  </main>
}
