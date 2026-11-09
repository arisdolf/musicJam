import { useEffect, useMemo, useRef, useState } from 'react'
import { searchYouTube } from '../services/youtube'

export default function MusicRoom({ roomCode, room, updateRoom, connection, members, onLeave }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [copied, setCopied] = useState(false)
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
  const visibleQueue = useMemo(() => room.queue || [], [room.queue])

  return <main className="music-room">
    <header className="player-header"><button className="back-button" onClick={onLeave} aria-label="Leave room">‹</button><a className="wordmark" href="#home"><span className="wordmark-icon">♫</span> jamroom</a><button className="room-share" onClick={shareCode}><span className="connection-light"/> {copied ? 'COPIED' : roomCode} <span className="share-mark">↗</span></button></header>
    <div className="room-content">
      <div className="room-line"><div><span className="room-status"><i/> {connection === 'connected' ? 'ROOM LIVE' : connection === 'local' ? 'LOCAL ROOM' : 'CONNECTING'}</span><h1>Now playing</h1></div><div className="room-listeners"><span className="listener-dots"><i/><i/></span><span>{members} {members === 1 ? 'here' : 'here'}</span></div></div>

      <section className="current-player" aria-label="Music player">
        <div className={`youtube-wrap ${currentTrack ? '' : 'youtube-empty'}`}><div id="youtube-player"/>{!currentTrack && <div className="empty-player"><span>♫</span><p>Pick a song to get started</p></div>}</div>
        <div className="song-now"><div className="song-copy">{currentTrack ? <><h2>{currentTrack.title}</h2><p>{currentTrack.artist}</p></> : <><h2>Nothing playing yet</h2><p>Search for a song and add it to the queue.</p></>}</div><div className="transport"><button className="transport-skip" aria-label="Next song" onClick={nextTrack}>|›</button><button className="transport-play" aria-label={room.playing ? 'Pause' : 'Play'} onClick={togglePlay} disabled={!currentTrack}>{room.playing ? 'Ⅱ' : '▶'}</button><span className="transport-spacer"/><span className="playing-together">● &nbsp;{members > 1 ? 'LISTENING TOGETHER' : 'ROOM PLAYER'}</span></div></div>
      </section>

      <section className="song-search"><h2>Add a song</h2><label className="search-input"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs or artists" aria-label="Search songs or artists"/><kbd>YOUTUBE</kbd></label>
        {query && <div className="search-results">{searching ? <p className="search-message">Searching…</p> : searchError ? <p className="search-message">{searchError}</p> : results.map((track) => <div className="search-result" key={track.id}><img src={track.thumbnail} alt=""/><div className="result-text"><strong>{track.title}</strong><small>{track.artist}</small></div><button onClick={() => addTrack(track)} aria-label={`Add ${track.title}`}>+</button></div>)}</div>}
      </section>

      <section className="queue-section"><div className="queue-heading"><h2>Up next</h2><span>{visibleQueue.length} {visibleQueue.length === 1 ? 'song' : 'songs'}</span></div>{visibleQueue.length === 0 ? <p className="queue-empty">Songs you add will show up here.</p> : <div className="queue-list">{visibleQueue.map((track, index) => <div className={`queue-song ${index === room.current ? 'active-song' : ''}`} key={`${track.id}-${index}`}><button className="queue-play" onClick={() => playTrack(index)} aria-label={`Play ${track.title}`}>{index === room.current && room.playing ? '♫' : '▶'}</button><img src={track.thumbnail} alt=""/><button className="queue-title" onClick={() => playTrack(index)}><strong>{track.title}</strong><small>{track.artist}</small></button><button className="remove-song" aria-label={`Remove ${track.title}`} onClick={() => removeTrack(index)}>×</button></div>)}</div>}</section>
      {connection === 'local' && <p className="local-notice">Room server is offline. This room only works in tabs on this device. Start the room server to sync with another device.</p>}
    </div>
  </main>
}
