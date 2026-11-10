import { useEffect, useRef, useState } from 'react'
import { searchYouTube } from '../services/youtube'
import AddToPlaylist from './AddToPlaylist'
import FeedbackModal from './FeedbackModal'
import { useAccount } from '../features/account/AccountContext'
import { Play, Pause, SkipForward, Search, Music2, Check, X, Plus, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'

export default function MusicRoom({ roomCode, room, updateRoom, connection, members, onLeave }) {
  const { user, openAuth, createPlaylist } = useAccount()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState('My playlist')
  const [savingQueue, setSavingQueue] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [draggedIndex, setDraggedIndex] = useState(null)
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
      setSearching(true); setSearchError(''); setResults([])
      try {
        const tracks = await searchYouTube(query.trim(), controller.signal)
        setResults(tracks)
        setSearchError(tracks.length ? '' : 'No songs found. Try another search.')
      } catch (error) {
        if (error.name !== 'AbortError') setFeedback(error.message)
      } finally { setSearching(false) }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const addTrack = (track) => {
    updateRoom((state) => {
      const existingIndex = state.queue.findIndex((item) => item.id === track.id)
      if (existingIndex >= 0) return { ...state, current: existingIndex, playing: true }
      const queue = [...state.queue, track]
      return { ...state, queue, current: queue.length - 1, playing: true }
    })
    if (playerReady) playerRef.current?.loadVideoById(track.id)
  }
  const playTrack = (index) => updateRoom((state) => ({ ...state, current: index, playing: true }))
  const moveTrack = (from, to) => updateRoom((state) => {
    if (from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length || from === to) return state
    const currentId = state.queue[state.current]?.id
    const queue = [...state.queue]
    const [track] = queue.splice(from, 1)
    queue.splice(to, 0, track)
    return { ...state, queue, current: queue.findIndex((item) => item.id === currentId) }
  })
  const dropTrack = (event, index) => {
    event.preventDefault()
    const from = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isInteger(from)) moveTrack(from, index)
    setDraggedIndex(null)
  }
  const removeTrack = (index) => updateRoom((state) => {
    const queue = state.queue.filter((_, itemIndex) => itemIndex !== index)
    const current = queue.length ? Math.min(state.current > index ? state.current - 1 : state.current, queue.length - 1) : 0
    return { ...state, queue, current, playing: queue.length ? state.playing : false }
  })
  const nextTrack = () => updateRoom((state) => state.queue.length < 2 ? { ...state, playing: false } : { ...state, current: (state.current + 1) % state.queue.length, playing: true })
  const togglePlay = () => updateRoom((state) => ({ ...state, playing: !state.playing }))

  const shareCode = async () => {
    try { await navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 1600) }
    catch { setFeedback(`Copy this room code to share it: ${roomCode}`) }
  }

  const saveQueue = async (event) => {
    event.preventDefault()
    if (!user) { openAuth('signup'); return }
    if (!playlistName.trim()) return
    setSavingQueue(true)
    try {
      await createPlaylist(playlistName.trim(), room.queue)
      setSaveModalOpen(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) { setFeedback(error.message || 'Could not save playlist.') }
    finally { setSavingQueue(false) }
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
        {room.queue.length > 0 && <button className="btn btn-small" onClick={() => { if (!user) { openAuth('signup'); return } setSaveModalOpen(true) }}>{saved ? <><Check size={14} /> Saved</> : <><Music2 size={14} /> Save as playlist</>}</button>}
      </div>
      {room.queue.length === 0
        ? <p className="empty">Songs you add will show up here.</p>
        : <ul className="track-list queue-list">
            {room.queue.map((track, index) => <li
              className={`track queue-track ${index === room.current ? 'active' : ''}${draggedIndex === index ? ' dragging' : ''}`}
              key={`${track.id}-${index}`}
              draggable
              onDragStart={(event) => { setDraggedIndex(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)) }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropTrack(event, index)}
              onDragEnd={() => setDraggedIndex(null)}
            >
              <span className="queue-drag-handle" aria-hidden="true" title="Drag to reorder"><GripVertical size={17} /></span>
              <button className="track-play" onClick={() => playTrack(index)} aria-label={`Play ${track.title}`}>{index === room.current && room.playing ? <Pause size={12} /> : <Play size={12} />}</button>
              <img src={track.thumbnail} alt="" />
              <button className="track-text as-button" onClick={() => playTrack(index)}><strong>{track.title}</strong><small>{track.artist}</small></button>
              <span className="queue-reorder-controls">
                <button className="queue-move-btn" onClick={() => moveTrack(index, index - 1)} disabled={index === 0} aria-label={`Move ${track.title} earlier`} title="Move earlier"><ArrowUp size={13} /></button>
                <button className="queue-move-btn" onClick={() => moveTrack(index, index + 1)} disabled={index === room.queue.length - 1} aria-label={`Move ${track.title} later`} title="Move later"><ArrowDown size={13} /></button>
              </span>
              <AddToPlaylist track={track} />
              <button className="icon-btn" aria-label={`Remove ${track.title}`} onClick={() => removeTrack(index)}><X size={16} /></button>
            </li>)}
          </ul>}
    </section>

    {saveModalOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSaveModalOpen(false) }}>
      <form className="modal" onSubmit={saveQueue} role="dialog" aria-modal="true" aria-labelledby="save-queue-title">
        <button type="button" className="modal-close" onClick={() => setSaveModalOpen(false)} aria-label="Close"><X size={19} /></button>
        <div className="auth-icon"><Music2 size={20} /></div>
        <h2 id="save-queue-title">Save this queue</h2>
        <p className="muted">Create a playlist with these {room.queue.length} songs.</p>
        <label className="field">Playlist name
          <input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} maxLength={60} autoFocus />
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={savingQueue || !playlistName.trim()}>{savingQueue ? 'Saving…' : 'Save playlist'}</button>
      </form>
    </div>}
    <FeedbackModal title="Something went wrong" message={feedback} onClose={() => setFeedback('')} />
  </main>
}
