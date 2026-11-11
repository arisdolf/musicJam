import { useMemo, useState } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { ArrowLeft, Check, Disc3, ListMusic, Music2, Pencil, Play, Plus, Search, Trash2, X, ListPlus } from 'lucide-react'
import FeedbackModal from '../components/FeedbackModal'
import ConfirmModal from '../components/ConfirmModal'
import { layoutTransitionName, withViewTransition } from '../utils/viewTransitions'

export default function Playlists({ onBrowse, onPlayTracks, onQueueTrack }) {
  const { user, openAuth, playlists, createPlaylist, renamePlaylist, removeFromPlaylist, deletePlaylist } = useAccount()
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [currentTrackId, setCurrentTrackId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const selected = playlists.find((playlist) => playlist.id === selectedId)
  const visiblePlaylists = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? playlists.filter((playlist) => playlist.name.toLowerCase().includes(query)) : playlists
  }, [playlists, search])

  if (!user) {
    return <main className="page narrow playlist-page">
      <div className="playlist-page-heading"><span className="page-icon"><ListMusic size={21} /></span><div><h1>Your playlists</h1><p className="muted">Keep your favorite tracks together.</p></div></div>
      <section className="playlist-empty-state">
        <Disc3 size={34} />
        <h2>Make your own music library</h2>
        <p className="muted">Sign in to create playlists and save tracks from Explore and your rooms.</p>
        <button className="btn btn-primary" onClick={() => openAuth('signup')}><Music2 size={16} /> Sign up or log in</button>
      </section>
    </main>
  }

  const create = async (event) => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    setBusy(true); setError('')
    try {
      const id = await createPlaylist(cleanName)
      setName('')
      setSelectedId(id)
    } catch (err) { setError(err.message || 'Could not create playlist.') }
    finally { setBusy(false) }
  }

  const remove = (playlist) => setDeleteTarget(playlist)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setError('')
    setBusy(true)
    try {
      await deletePlaylist(deleteTarget.id)
      if (selectedId === deleteTarget.id) { setSelectedId(null); setCurrentTrackId(null) }
      setDeleteTarget(null)
    } catch (err) { setDeleteTarget(null); setError(err.message || 'Could not delete playlist.') }
    finally { setBusy(false) }
  }

  const saveName = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    try { await renamePlaylist(selected.id, editName); setEditing(false) }
    catch (err) { setError(err.message || 'Could not rename playlist.') }
    finally { setBusy(false) }
  }

  const removeTrack = async (track) => {
    setError('')
    try {
      await removeFromPlaylist(selected.id, track.id)
      if (currentTrackId === track.id) setCurrentTrackId(null)
    }
    catch (err) { setError(err.message || 'Could not remove track.') }
  }

  const playAt = (index) => {
    if (!selected?.tracks[index]) return
    setCurrentTrackId(selected.tracks[index].id)
    onPlayTracks(selected.tracks, index)
  }

  const openPlaylist = (playlist, playFirst = false) => withViewTransition(() => {
    setSelectedId(playlist.id)
    setCurrentTrackId(playFirst ? playlist.tracks[0]?.id || null : null)
    setError('')
  })

  const showPlaylists = () => withViewTransition(() => {
    setSelectedId(null)
    setCurrentTrackId(null)
    setEditing(false)
    setError('')
  })

  if (selected) {
    return <main className="page playlist-page">
      <button className="btn btn-text playlist-back" onClick={showPlaylists}><ArrowLeft size={16} /> All playlists</button>
      <section className="playlist-detail-hero">
        <div className="playlist-cover large" style={{ viewTransitionName: layoutTransitionName(selected.id) }} aria-hidden="true">
          {selected.tracks.slice(0, 4).map((track, index) => <img key={`${track.id}-${index}`} src={track.thumbnail || ''} alt="" />)}
          {selected.tracks.length === 0 && <Music2 size={34} />}
        </div>
        <div className="playlist-detail-copy">
          <span className="eyebrow">PLAYLIST</span>
          {editing
            ? <form className="playlist-rename-form" onSubmit={saveName}>
                <input value={editName} onChange={(event) => setEditName(event.target.value)} aria-label="Playlist name" maxLength={60} autoFocus />
                <button className="icon-btn" type="submit" aria-label="Save playlist name" disabled={busy || !editName.trim()}><Check size={17} /></button>
                <button className="icon-btn" type="button" aria-label="Cancel rename" onClick={() => setEditing(false)}><X size={17} /></button>
              </form>
            : <div className="playlist-title-row"><h1>{selected.name}</h1><button className="icon-btn" onClick={() => { setEditName(selected.name); setEditing(true); setError('') }} aria-label="Rename playlist"><Pencil size={16} /></button></div>}
          <p className="muted">{selected.tracks.length} {selected.tracks.length === 1 ? 'track' : 'tracks'} · Your saved collection</p>
          <div className="playlist-detail-actions">
            <button className="btn btn-primary" onClick={() => playAt(0)} disabled={!selected.tracks.length}><Play size={16} /> Play playlist</button>
            <button className="btn" onClick={onBrowse}><Plus size={16} /> Add songs</button>
            <button className="btn btn-text danger-text" onClick={() => remove(selected)}><Trash2 size={16} /> Delete</button>
          </div>
        </div>
      </section>
      <section className="playlist-tracks-section">
        <div className="block-head"><h2><ListMusic size={17} /> Songs</h2><span className="muted">{selected.tracks.length}</span></div>
        {selected.tracks.length === 0
          ? <div className="playlist-empty-state compact"><Music2 size={28} /><h2>This playlist is empty</h2><p className="muted">Find a song you like and save it here.</p><button className="btn btn-primary btn-small" onClick={onBrowse}><Search size={15} /> Explore songs</button></div>
          : <ul className="track-list playlist-track-list">
              {selected.tracks.map((track, index) => <li className="track playlist-track" key={`${track.id}-${index}`}>
                <button className={`track-play ${track.id === currentTrackId ? 'is-selected' : ''}`} onClick={() => playAt(index)} aria-label={`Play ${track.title}`} title="Play this song"><Play size={15} fill="currentColor" /></button>
                <img src={track.thumbnail} alt="" loading="lazy" />
                <div className="track-text"><strong title={track.title}>{track.title}</strong><small>{track.artist}</small></div>
                <button className="icon-btn playlist-add-queue" onClick={(event) => onQueueTrack(track, event.currentTarget)} aria-label={`Add ${track.title} to queue`} title="Add to queue"><ListPlus size={16} /></button>
                <button className="icon-btn" onClick={() => removeTrack(track)} aria-label={`Remove ${track.title}`} title="Remove from playlist"><Trash2 size={16} /></button>
              </li>)}
            </ul>}
      </section>
      <FeedbackModal title="Playlist update failed" message={error} onClose={() => setError('')} />
      {deleteTarget && <ConfirmModal title={`Delete “${deleteTarget.name}”?`} message="This permanently removes the playlist and its saved songs." busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
    </main>
  }

  return <main className="page playlist-page">
    <div className="playlist-page-heading"><span className="page-icon"><ListMusic size={21} /></span><div><h1>Your playlists</h1><p className="muted">Your saved music, all in one place.</p></div></div>
    <form className="playlist-create-form" onSubmit={create}>
      <label className="sr-only" htmlFor="new-playlist-name">New playlist name</label>
      <input id="new-playlist-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Give your playlist a name" maxLength={60} />
      <button className="btn btn-primary" type="submit" disabled={!name.trim() || busy}><Plus size={16} /> Create playlist</button>
    </form>
    <FeedbackModal title="Playlist update failed" message={error} onClose={() => setError('')} />
    {deleteTarget && <ConfirmModal title={`Delete “${deleteTarget.name}”?`} message="This permanently removes the playlist and its saved songs." busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
    {playlists.length > 0 && <label className="playlist-search"><Search size={17} /><span className="sr-only">Search playlists</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your playlists" /></label>}
    {playlists.length === 0
      ? <section className="playlist-empty-state"><Disc3 size={34} /><h2>Your library starts here</h2><p className="muted">Create a playlist, then save songs from Explore or your music rooms.</p><button className="btn btn-text" onClick={onBrowse}><Search size={16} /> Explore music</button></section>
      : visiblePlaylists.length === 0
        ? <p className="empty">No playlists match “{search}”.</p>
        : <div className="playlist-grid">
            {visiblePlaylists.map((playlist) => <article className="playlist-card" key={playlist.id}>
                <button className="playlist-card-open" onClick={() => openPlaylist(playlist)} aria-label={`Open ${playlist.name}`}>
                <span className="playlist-cover" style={{ viewTransitionName: layoutTransitionName(playlist.id) }} aria-hidden="true">
                  {playlist.tracks.slice(0, 4).map((track, index) => <img key={`${track.id}-${index}`} src={track.thumbnail || ''} alt="" loading="lazy" />)}
                  {playlist.tracks.length === 0 && <Music2 size={28} />}
                </span>
                <span className="playlist-card-copy"><strong>{playlist.name}</strong><small>{playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}</small></span>
                <span className="playlist-card-play"><Play size={17} fill="currentColor" /></span>
              </button>
              <div className="playlist-card-actions">
                <button className="btn btn-text btn-small" onClick={() => {
                  openPlaylist(playlist, true)
                  onPlayTracks(playlist.tracks, 0)
                }} disabled={!playlist.tracks.length}><Play size={14} /> Play</button>
                <button className="icon-btn" onClick={() => remove(playlist)} aria-label={`Delete ${playlist.name}`} title="Delete playlist"><Trash2 size={15} /></button>
              </div>
            </article>)}
          </div>}
  </main>
}
