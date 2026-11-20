import { useEffect, useRef, useState } from 'react'
import { searchYouTube, getSimilarTracks } from '../services/youtube'
import AddToPlaylist from './AddToPlaylist'
import FeedbackModal from './FeedbackModal'
import { useAccount } from '../features/account/AccountContext'
import ConfirmModal from './ConfirmModal'
import { useDragReorder } from '../hooks/useDragReorder'
import InviteFriendsModal from './InviteFriendsModal'
import { useTopbar } from './TopBarContext'
import LikeButton from './LikeButton'
import TrackMenu, { DotsMenu } from './TrackMenu'
import { Play, Search, Music2, Check, X, Plus, Trash2, GripVertical, ListMusic, ListPlus, ChevronDown, LogOut, UserPlus, Sparkles, ListStart } from 'lucide-react'

export default function MusicRoom({ roomCode, room, updateRoom, connection, members, onLeave, onPlayTrack, onQueueTrack, onPlayTracks, onQueueTracks, onPlayNext }) {
  const { user, openAuth, createPlaylist } = useAccount()
  const [playlistsOpen, setPlaylistsOpen] = useState(false)
  const [seed, setSeed] = useState(null)
  const [similar, setSimilar] = useState({ seedId: '', tracks: [], loading: false, error: '' })
  const queueIds = room.queue.map((track) => track.id)
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState({ query: '', results: [], searching: false, error: '' })
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState('My playlist')
  const [savingQueue, setSavingQueue] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const clearQueue = () => updateRoom((state) => ({ ...state, queue: [], current: 0, playing: false }))
  useTopbar(`Room ${roomCode}`, () => setLeaveOpen(true))
  const normalizedQuery = query.trim()
  const searchHasResult = searchState.query === normalizedQuery
  const results = searchHasResult ? searchState.results : []
  const searching = Boolean(normalizedQuery && (!searchHasResult || searchState.searching))
  const searchError = searchHasResult ? searchState.error : ''
  const [inviteOpen, setInviteOpen] = useState(false)
  const autoAdded = useRef(new Set())                 // songs we already auto-queued suggestions for
  const latest = useRef({ queue: room.queue, onQueueTracks })
  useEffect(() => { latest.current = { queue: room.queue, onQueueTracks } })
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
            error: tracks.length ? '' : 'No songs found. Try another search.',
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

  useEffect(() => {
    const only = room.queue.length === 1 ? room.queue[0] : null
    setSeed((prev) => {
      if (only) return prev?.id === only.id ? prev : only
      return prev && room.queue.some((track) => track.id === prev.id) ? prev : null
    })
  }, [room.queue])

  function SongRow({ track, queued, onPlayTrack, onPlayNext, onQueueTrack }) {
    return <div className="track">
      <img src={track.thumbnail} alt="" />
      <div className="track-text"><strong>{track.title}</strong><small>{track.artist}</small></div>
      <div className="track-actions">
        <AddToPlaylist track={track} />
        <button className="icon-btn" onClick={() => onPlayTrack(track)} aria-label={`Play ${track.title}`} title="Play now"><Play size={16} fill="currentColor" /></button>
        <button className="icon-btn" onClick={() => onPlayNext(track)} aria-label={`Play ${track.title} next`} title="Play next"><ListStart size={16} /></button>
        <button className="icon-btn add-btn" disabled={queued} onClick={(event) => onQueueTrack(track, event.currentTarget)} aria-label={`Add ${track.title} to queue`} title={queued ? 'In queue' : 'Add to queue'}>{queued ? <Check size={16} /> : <Plus size={17} />}</button>
      </div>
    </div>
  }

  useEffect(() => {
    if (!seed) return undefined
    const controller = new AbortController()
    setSimilar({ seedId: seed.id, tracks: [], loading: true, error: '' })
    getSimilarTracks(seed, controller.signal)
      .then((tracks) => {
        if (controller.signal.aborted) return
        setSimilar({ seedId: seed.id, tracks, loading: false, error: tracks.length ? '' : 'No similar songs found.' })

        // Auto-add to the queue, but only once per song, and only if that song is still alone in the queue.
        const { queue, onQueueTracks: addAll } = latest.current
        if (tracks.length && !autoAdded.current.has(seed.id) && queue.length === 1 && queue[0].id === seed.id) {
          autoAdded.current.add(seed.id)
          addAll(tracks)
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setSimilar({ seedId: seed.id, tracks: [], loading: false, error: error.message || 'Could not load similar songs.' })
        }
      })
    return () => controller.abort()
  }, [seed])

  const moveTrack = (from, to) => updateRoom((state) => {
    if (from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length || from === to) return state
    const currentId = state.queue[state.current]?.id
    const queue = [...state.queue]
    const [track] = queue.splice(from, 1)
    queue.splice(to, 0, track)
    return { ...state, queue, current: queue.findIndex((item) => item.id === currentId) }
  })

  const queueDrag = useDragReorder(moveTrack)

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
      <button className="btn btn-small btn-leave" onClick={() => setLeaveOpen(true)}><LogOut size={15} /> Leave</button>
      <button className="btn btn-small btn-primary" onClick={() => setInviteOpen(true)}><UserPlus size={15} /> Invite</button>
    </div>
    <div className="room-meta room-meta-row">
      <span className={`dot dot-${connection}`} title={status} role="img" aria-label={status} />
      <span>{members} {members === 1 ? 'listener' : 'listeners'}</span>
      <button className="chip" onClick={shareCode} title="Copy room code">{copied ? <><Check size={13} /> Copied</> : roomCode}</button>
    </div>
    <section className="block">
      <h2><Search size={17} /> Add a song</h2>
      <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs or artists" aria-label="Search songs or artists" />
      {query && <div className="results">
        {searching ? <p className="message">Searching…</p>
          : searchError ? <p className="message">{searchError}</p>

            : results.map((track) => <SongRow key={track.id} track={track} queued={queueIds.includes(track.id)} onPlayTrack={onPlayTrack} onPlayNext={onPlayNext} onQueueTrack={onQueueTrack} />)}
      </div>}
    </section>
    {seed && similar.seedId === seed.id && <section className="block">
      <div className="block-head">
        <h2><Sparkles size={17} /> Similar vibes</h2>
        {similar.tracks.length > 0 && <button className="btn btn-small" onClick={() => onQueueTracks(similar.tracks)}><ListPlus size={14} /> Add all</button>}
      </div>
      <div className="results similar-results">
        {similar.loading ? <p className="message">Finding songs with the same vibe…</p>
          : similar.error ? <p className="message">{similar.error}</p>
            : similar.tracks.map((track) => <SongRow key={track.id} track={track} queued={queueIds.includes(track.id)} onPlayTrack={onPlayTrack} onPlayNext={onPlayNext} onQueueTrack={onQueueTrack} />)}
      </div>
    </section>}
    <section className="block">
      <button className="block-toggle" onClick={() => setPlaylistsOpen((open) => !open)} aria-expanded={playlistsOpen}>
        <span><ListMusic size={17} /> From your playlists</span>
        <ChevronDown size={18} className={playlistsOpen ? 'flip' : ''} />
      </button>
      {playlistsOpen && <div className="dropdown-panel">
        <RoomPlaylists onPlayTracks={onPlayTracks} onQueueTracks={onQueueTracks} onPlayTrack={onPlayTrack} onQueueTrack={onQueueTrack} />
      </div>}
    </section>

    <section className="block">
      <div className="block-head">
        <h2>Up next <small className="muted">{room.queue.length} {room.queue.length === 1 ? 'song' : 'songs'}</small></h2>
        {room.queue.length > 0 && <div className="block-head-actions">
          <button className="btn btn-small" onClick={() => { if (!user) { openAuth('signup'); return } setSaveModalOpen(true) }}>{saved ? <><Check size={14} /> Saved</> : <><Music2 size={14} /> Save as playlist</>}</button>
          <DotsMenu label="Queue options" items={[
            { label: 'Remove all tracks', icon: <Trash2 size={16} />, danger: true, onClick: () => setClearOpen(true) },
          ]} />
        </div>}
      </div>
      {room.queue.length === 0
        ? <p className="empty">Songs you add will show up here.</p>
        : <ul ref={queueDrag.listRef} className="track-list queue-list">
          {room.queue.map((track, index) => {
            const isCurrent = index === room.current
            return <li
              className={`track queue-track ${isCurrent ? 'active' : ''}${queueDrag.dragIndex === index ? ' dragging' : ''}`}
              key={track.id}
              style={queueDrag.itemStyle(index)}
            >
              <span className="queue-drag-handle" {...queueDrag.handleProps(index)} title="Drag to reorder" aria-label={`Drag ${track.title} to reorder`}><GripVertical size={17} /></span>
              <button className={`queue-thumb${isCurrent ? ' is-playing' : ''}`} onClick={() => onPlayTrack(track)} aria-label={`Play ${track.title}`}>
                <img src={track.thumbnail} alt="" />
                {isCurrent && <span className={`eq-bars${room.playing ? '' : ' paused'}`} aria-hidden="true"><i /><i /><i /></span>}
              </button>
              <button className="track-text as-button" onClick={() => onPlayTrack(track)}><strong>{track.title}</strong><small>{track.artist}</small></button>
              <div className="queue-actions">
                <LikeButton track={track} />
                <TrackMenu
                  track={track}
                  playNextDisabled={isCurrent || index === room.current + 1}
                  onPlayNext={() => onPlayNext(track)}
                  onRemove={() => removeTrack(index)}
                />
              </div>
            </li>
          })}
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
    {inviteOpen && <InviteFriendsModal roomCode={roomCode} onClose={() => setInviteOpen(false)} />}
    <FeedbackModal title="Something went wrong" message={feedback} onClose={() => setFeedback('')} />
    {leaveOpen && <ConfirmModal
      title="Are you sure you want to leave?"
      message={`You're about to leave room ${roomCode}. You can rejoin any time with the room code.`}
      confirmLabel="Leave room"
      icon={LogOut}
      danger={false}
      onCancel={() => setLeaveOpen(false)}
      onConfirm={() => { setLeaveOpen(false); onLeave() }}
    />}
    {clearOpen && <ConfirmModal
      title="Remove all tracks?"
      message="This clears the whole queue for everyone in the room."
      confirmLabel="Remove all"
      onCancel={() => setClearOpen(false)}
      onConfirm={() => { setClearOpen(false); clearQueue() }}
    />}
  </main>
}

function RoomPlaylists({ onPlayTracks, onQueueTracks, onPlayTrack, onQueueTrack }) {
  const { user, openAuth, playlists, playlistsReady, playlistsError } = useAccount()
  const [openId, setOpenId] = useState(null)

  if (!user) {
    return <div className="empty-result-card">
      <span>Log in to play your saved playlists here.</span>
      <button className="btn btn-small btn-primary" onClick={() => openAuth('login')}>Log in</button>
    </div>
  }
  if (playlistsError) return <p className="message">{playlistsError}</p>
  if (!playlistsReady) return <p className="message">Loading your playlists…</p>
  if (!playlists.length) return <p className="empty">You have no playlists yet. Save songs with the heart button.</p>

  return <ul className="track-list room-playlists">
    {playlists.map((playlist) => {
      const open = openId === playlist.id
      const count = playlist.tracks.length
      return <li key={playlist.id} className="room-playlist">
        <div className="track">
          <button className="track-text as-button" onClick={() => setOpenId(open ? null : playlist.id)} aria-expanded={open}>
            <strong>{playlist.name}</strong>
            <small>{count} {count === 1 ? 'song' : 'songs'}</small>
          </button>
          <button className="icon-btn" onClick={() => onPlayTracks(playlist.tracks, 0)} disabled={!count} aria-label={`Play ${playlist.name}`} title="Play playlist in room"><Play size={16} fill="currentColor" /></button>
          <button className="icon-btn add-btn" onClick={() => onQueueTracks(playlist.tracks)} disabled={!count} aria-label={`Add all of ${playlist.name} to queue`} title="Add all to queue"><ListPlus size={17} /></button>
          <button className="icon-btn" onClick={() => setOpenId(open ? null : playlist.id)} aria-label={open ? 'Hide songs' : 'Show songs'} style={{ transform: open ? 'rotate(180deg)' : 'none' }}><ChevronDown size={17} /></button>
        </div>
        {open && <ul className="track-list room-playlist-tracks">
          {playlist.tracks.map((track) => <li className="track" key={track.id}>
            <img src={track.thumbnail || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" loading="lazy" />
            <div className="track-text"><strong title={track.title}>{track.title}</strong><small>{track.artist}</small></div>
            <button className="icon-btn" onClick={() => onPlayTrack(track)} aria-label={`Play ${track.title}`} title="Play now"><Play size={16} fill="currentColor" /></button>
            <button className="icon-btn add-btn" onClick={(event) => onQueueTrack(track, event.currentTarget)} aria-label={`Add ${track.title} to queue`} title="Add to queue"><Plus size={17} /></button>
          </li>)}
        </ul>}
      </li>
    })}
  </ul>
}