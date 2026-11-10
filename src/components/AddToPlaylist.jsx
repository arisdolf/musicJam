import { useEffect, useRef, useState } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { Heart, Check, Plus } from 'lucide-react'

export default function AddToPlaylist({ track }) {
  const { user, openAuth, playlists, createPlaylist, addToPlaylist } = useAccount()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const [popoverPosition, setPopoverPosition] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggle = () => {
    if (user) {
      setStatus('')
      setPopoverPosition(getPopoverPosition(buttonRef.current))
      setOpen((value) => !value)
    }
    else openAuth('signup')
  }

  const add = async (playlist) => {
    setBusy(true); setStatus('')
    try {
      await addToPlaylist(playlist.id, track)
      setStatus(`Added to ${playlist.name}`)
    } catch (error) { setStatus(error.message || 'Could not save this track.') }
    finally { setBusy(false) }
  }

  const create = async (event) => {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true); setStatus('')
    try {
      await createPlaylist(name.trim(), [track])
      setName('')
      setStatus('Playlist created and song saved')
    } catch (error) { setStatus(error.message || 'Could not save this track.') }
    finally { setBusy(false) }
  }

  return <div className="popover-wrap" ref={ref}>
    <button ref={buttonRef} className="icon-btn save-track-btn" onClick={toggle} aria-label={`Add ${track.title} to a playlist`} aria-expanded={open} title="Add to playlist"><Heart size={17} /></button>
    {open && <div className="popover" style={popoverPosition}>
      <div className="popover-title">Add to playlist</div>
      {playlists.length === 0 && <p className="popover-empty">No playlists yet. Create your first one below.</p>}
      {playlists.map((playlist) => {
        const added = playlist.tracks.some((item) => item.id === track.id)
        return <button key={playlist.id} className="popover-item" disabled={added || busy} onClick={() => add(playlist)}>
          <span>{playlist.name}</span><span>{added ? <Check size={15} /> : <Plus size={14} />}</span>
        </button>
      })}
      <form className="popover-new" onSubmit={create}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New playlist name" aria-label="New playlist name" maxLength={60} />
        <button className="btn btn-small" type="submit" disabled={!name.trim() || busy}><Plus size={14} /> Create</button>
      </form>
      {status && <p className="popover-status" role="status">{status}</p>}
    </div>}
  </div>
}

function getPopoverPosition(button) {
  if (!button) return undefined
  const rect = button.getBoundingClientRect()
  const width = Math.min(280, window.innerWidth - 24)
  const height = Math.min(320, window.innerHeight - 24)
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
  const below = rect.bottom + 8
  const top = below + height <= window.innerHeight - 12
    ? below
    : Math.max(12, rect.top - height - 8)
  return { top, left, width }
}
