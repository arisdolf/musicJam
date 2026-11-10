import { useState } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { Plus, Play, Trash2, Music2 } from 'lucide-react'

export default function Playlists({ onPlay }) {
  const { user, openAuth, playlists, createPlaylist, removeFromPlaylist, deletePlaylist } = useAccount()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  if (!user) {
    return <main className="page narrow">
      <h1>Your playlists</h1>
      <p className="muted">Sign up to save songs into playlists and listen to them any time.</p>
      <button className="btn btn-primary" onClick={() => openAuth('signup')}><Music2 size={16} /> Sign up</button>
    </main>
  }

  const create = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    try { await createPlaylist(name); setName(''); setError('') } catch (err) { setError(err.message || 'Could not create playlist.') }
  }

  const remove = (playlist) => {
    if (window.confirm(`Delete "${playlist.name}"?`)) deletePlaylist(playlist.id).catch((err) => setError(err.message || 'Could not delete playlist.'))
  }

  return <main className="page narrow">
    <h1>Your playlists</h1>
    <form className="inline-form" onSubmit={create}>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New playlist name" aria-label="New playlist name" />
      <button className="btn btn-primary" type="submit" disabled={!name.trim()}><Plus size={16} /> Create</button>
    </form>

    {error && <p className="form-error" role="alert">{error}</p>}
    {playlists.length === 0
      ? <p className="empty">No playlists yet. Create one above, or tap ♡ on any song in a room to save it.</p>
      : playlists.map((playlist) => <section className="playlist" key={playlist.id}>
          <div className="playlist-head">
            <div>
              <h2>{playlist.name}</h2>
              <small className="muted">{playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}</small>
            </div>
            <div className="row-actions">
              <button className="btn btn-primary btn-small" disabled={!playlist.tracks.length} onClick={() => onPlay(playlist)}><Play size={14} /> Play</button>
              <button className="btn btn-small" onClick={() => remove(playlist)}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
          {playlist.tracks.length === 0
            ? <p className="empty small">This playlist is empty.</p>
            : <ul className="track-list">
                {playlist.tracks.map((track) => <li className="track" key={track.id}>
                  <img src={track.thumbnail} alt="" />
                  <div className="track-text"><strong>{track.title}</strong><small>{track.artist}</small></div>
                  <button className="icon-btn" onClick={() => removeFromPlaylist(playlist.id, track.id).catch((err) => setError(err.message || 'Could not remove track.'))} aria-label={`Remove ${track.title}`}><Trash2 size={15} /></button>
                </li>)}
              </ul>}
        </section>)}
  </main>
}
