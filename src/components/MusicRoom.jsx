import { useEffect, useState } from 'react'
import { searchYouTube } from '../services/youtube'
import AddToPlaylist from './AddToPlaylist'
import FeedbackModal from './FeedbackModal'
import { useAccount } from '../features/account/AccountContext'
import { Play, Search, Music2, Check, X, Plus, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'

export default function MusicRoom({ roomCode, room, updateRoom, connection, members, onLeave, onPlayTrack, onQueueTrack }) {
  const { user, openAuth, createPlaylist } = useAccount()
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState({ query: '', results: [], searching: false, error: '' })
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState('My playlist')
  const [savingQueue, setSavingQueue] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [draggedIndex, setDraggedIndex] = useState(null)
  const normalizedQuery = query.trim()
  const searchHasResult = searchState.query === normalizedQuery
  const results = searchHasResult ? searchState.results : []
  const searching = Boolean(normalizedQuery && (!searchHasResult || searchState.searching))
  const searchError = searchHasResult ? searchState.error : ''

  useEffect(() => {
    if (!normalizedQuery) return undefined
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearchState({ query: normalizedQuery, results: [], searching: true, error: '' })
      try {
        const tracks = await searchYouTube(normalizedQuery, controller.signal)
        if (!controller.signal.aborted) {
          setSearchState({
            query: normalizedQuery,
            results: tracks,
            searching: false,
            error: tracks.length ? '' : 'No songs with synced lyrics found. Try another search.',
          })
        }
      } catch (error) {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setSearchState({ query: normalizedQuery, results: [], searching: false, error: error.message || 'Song search failed.' })
        }
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [normalizedQuery])

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
              <button className="icon-btn" onClick={() => onPlayTrack(track)} aria-label={`Play ${track.title}`} title="Play now"><Play size={16} fill="currentColor" /></button>
              <button className="icon-btn add-btn" onClick={(event) => onQueueTrack(track, event.currentTarget)} aria-label={`Add ${track.title} to queue`} title="Add to queue"><Plus size={17} /></button>
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
              <button className="track-play" onClick={() => onPlayTrack(track)} aria-label={`Play ${track.title}`}><Play size={12} /></button>
              <img src={track.thumbnail} alt="" />
              <button className="track-text as-button" onClick={() => onPlayTrack(track)}><strong>{track.title}</strong><small>{track.artist}</small></button>
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
