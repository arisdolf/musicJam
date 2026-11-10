import { useEffect, useRef, useState } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { Heart, Check, Plus } from 'lucide-react'

export default function AddToPlaylist({ track }) {
  const { user, openAuth, playlists, createPlaylist, addToPlaylist } = useAccount()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = () => { if (user) setOpen((value) => !value); else openAuth('signup') }

  const create = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    try { await createPlaylist(name, [track]); setName(''); setOpen(false) }
    catch (error) { window.alert(error.message || 'Could not save this track.') }
  }

  return <div className="popover-wrap" ref={ref}>
    <button className="icon-btn" onClick={toggle} aria-label={`Save ${track.title} to a playlist`} title="Save to playlist"><Heart size={17} /></button>
    {open && <div className="popover">
      <div className="popover-title">Save to playlist</div>
      {playlists.length === 0 && <p className="popover-empty">No playlists yet. Create your first one below.</p>}
      {playlists.map((playlist) => {
        const added = playlist.tracks.some((item) => item.id === track.id)
        return <button key={playlist.id} className="popover-item" disabled={added} onClick={async () => { try { await addToPlaylist(playlist.id, track) } catch (error) { window.alert(error.message || 'Could not save this track.') } }}>
          <span>{playlist.name}</span><span>{added ? <Check size={15} /> : null}</span>
        </button>
      })}
      <form className="popover-new" onSubmit={create}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New playlist name" aria-label="New playlist name" />
        <button className="btn btn-small" type="submit" disabled={!name.trim()}><Plus size={14} /> Create</button>
      </form>
    </div>}
  </div>
}
