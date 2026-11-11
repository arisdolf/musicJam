import { useEffect, useRef, useState } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { Heart, Check, Plus } from 'lucide-react'
import FeedbackModal from './FeedbackModal'
import { rubberBandAtBounds } from '../utils/motion'

export default function AddToPlaylist({ track }) {
  const { user, openAuth, playlists, createPlaylist, addToPlaylist } = useAccount()
  const [open, setOpen] = useState(false)
  const [popoverMounted, setPopoverMounted] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const [popoverPosition, setPopoverPosition] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    const closeOnScroll = (event) => { if (!popoverRef.current?.contains(event.target)) setOpen(false) }
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
    const onResize = () => setPopoverPosition(getPopoverPosition(buttonRef.current))
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const toggle = () => {
    if (user) {
      setStatus('')
      if (open) setOpen(false)
      else {
        setPopoverPosition(getPopoverPosition(buttonRef.current))
        setPopoverMounted(true)
        setOpen(true)
      }
    }
    else openAuth('signup')
  }

  const add = async (playlist) => {
    setBusy(true); setStatus('')
    try {
      await addToPlaylist(playlist.id, track)
      setStatus(`Added to ${playlist.name}`)
    } catch (error) { setFeedback(error.message || 'Could not save this track.') }
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
    } catch (error) { setFeedback(error.message || 'Could not save this track.') }
    finally { setBusy(false) }
  }

  return <div className="popover-wrap" ref={ref}>
    <button ref={buttonRef} className="icon-btn save-track-btn" onClick={toggle} aria-label={`Add ${track.title} to a playlist`} aria-expanded={open} title="Add to playlist"><Heart size={17} /></button>
    {popoverMounted && <div
      className={`popover${open ? ' popover-enter' : ' popover-exit'}`}
      ref={popoverRef}
      style={popoverPosition}
      role="dialog"
      aria-label="Add to playlist"
      onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}
      onAnimationEnd={(event) => { if (event.animationName === 'popover-exit') setPopoverMounted(false) }}
    >
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
      {status && <p key={status} className="popover-status motion-success" role="status">{status}</p>}
    </div>}
    <FeedbackModal title="Could not save this song" message={feedback} onClose={() => setFeedback('')} />
  </div>
}

function getPopoverPosition(button) {
  if (!button) return undefined
  const rect = button.getBoundingClientRect()
  if (window.innerWidth <= 480) {
    const height = Math.min(window.innerHeight * 0.68, 460)
    const sheetTop = window.innerHeight - (68 + 10) - height
    return {
      top: 'auto',
      left: 8,
      right: 8,
      bottom: 'calc(68px + env(safe-area-inset-bottom) + 10px)',
      width: 'auto',
      maxHeight: height,
      transformOrigin: `${rect.left + rect.width / 2 - 8}px ${rect.top + rect.height / 2 - sheetTop}px`,
    }
  }
  const width = Math.min(280, window.innerWidth - 24)
  const height = Math.min(320, window.innerHeight - 24)
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
  const below = rect.bottom + 8
  const top = below + height <= window.innerHeight - 12
    ? below
    : Math.max(12, rect.top - height - 8)
  const originX = Math.max(0, Math.min(width, rect.left + rect.width / 2 - left))
  const originY = Math.max(0, Math.min(height, rect.top + rect.height / 2 - top))
  return { top, left, width, maxHeight: height, transformOrigin: `${originX}px ${originY}px` }
}
