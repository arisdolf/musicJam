import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Heart, LogIn, Plus, UserPlus } from 'lucide-react'
import { Skeleton, TrackSkeletonList } from './Skeleton'
import { useAccount } from '../features/account/AccountContext'
import { rubberBandAtBounds } from '../utils/motion'

const anchorOf = (anchorRef, buttonRef) => anchorRef?.current || buttonRef.current

// Default: heart button + popover (desktop) / bottom sheet (phone).
// Controlled (hideButton + open/onOpenChange + anchorRef): opened from somewhere else, e.g. a 3-dot menu.
export default function AddToPlaylist({ track, hideButton = false, open: openProp, onOpenChange, anchorRef }) {
  const { user, openAuth, playlists, playlistsReady, playlistsError, createPlaylist, addToPlaylist, removeFromPlaylist } = useAccount()
  const controlled = openProp !== undefined
  const [openState, setOpenState] = useState(false)
  const open = controlled ? openProp : openState
  const setOpen = useCallback((value) => {
    if (controlled) onOpenChange?.(value)
    else setOpenState(value)
  }, [controlled, onOpenChange])

  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'error', text }
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)

  const own = playlists.filter((playlist) => !playlist.isLiked) // Liked songs is handled by the heart
  const savedCount = user ? own.filter((playlist) => playlist.tracks.some((item) => item.id === track.id)).length : 0
  const saved = savedCount > 0
  const emptyLibrary = Boolean(user && playlistsReady && !playlistsError && own.length === 0)

  const openPopover = () => {
    setMessage(null)
    setPosition(getPosition(anchorOf(anchorRef, buttonRef)))
    setMounted(true)
    setOpen(true)
  }

  const close = useCallback(() => setOpen(false), [setOpen])

  // Controlled mode: the parent flips `open`, so mount and position here.
  useEffect(() => {
    if (!controlled || !open) return
    setMessage(null)
    setPosition(getPosition(anchorOf(anchorRef, buttonRef)))
    setMounted(true)
  }, [controlled, open, anchorRef])

  // Unmount once the exit animation has had time to finish.
  useEffect(() => {
    if (open || !mounted) return undefined
    const timer = setTimeout(() => setMounted(false), 260)
    return () => clearTimeout(timer)
  }, [open, mounted])

  // Outside click, Escape, and keeping the popover attached to its anchor.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (wrapRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      anchorOf(anchorRef, buttonRef)?.focus()
    }
    let frame = 0
    const reposition = () => {
      const button = anchorOf(anchorRef, buttonRef)
      if (!button) return
      const rect = button.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return } // scrolled away
      const next = getPosition(button)
      setPosition((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const onMove = (event) => {
      if (event?.target instanceof Node && popoverRef.current?.contains(event.target)) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reposition)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, anchorRef, setOpen])

  // Move focus into the popover so keyboard and screen-reader users land in it.
  useEffect(() => {
    if (!open) return undefined
    const frame = requestAnimationFrame(() => {
      const target = popoverRef.current?.querySelector('[data-autofocus]')
        || popoverRef.current?.querySelector('button:not(:disabled), input')
      target?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const toggleTrack = async (playlist, has) => {
    setMessage({ type: 'ok', text: has ? `Removed from ${playlist.name}` : `Added to ${playlist.name}` })
    try {
      if (has) await removeFromPlaylist(playlist.id, track.id)
      else await addToPlaylist(playlist.id, track)
    } catch (error) {
      console.error('Playlist update failed:', error)
      setMessage({ type: 'error', text: friendlyError(error) })
    }
  }

  const create = async (event) => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName || creating) return
    setCreating(true)
    setMessage(null)
    try {
      await createPlaylist(cleanName, [track])
      setName('')
      setMessage({ type: 'ok', text: `Saved to new playlist "${cleanName}"` })
    } catch (error) {
      console.error('Playlist create failed:', error)
      setMessage({ type: 'error', text: friendlyError(error) })
    } finally { setCreating(false) }
  }

  const label = saved
    ? `Saved in ${savedCount} ${savedCount === 1 ? 'playlist' : 'playlists'}. Edit playlists for ${track.title}`
    : `Add ${track.title} to a playlist`

  const portal = mounted && createPortal(<>
    <div className={`popover-scrim${open ? '' : ' is-closing'}`} onClick={close} />
    <div
      className={`popover ${open ? 'popover-enter' : 'popover-exit'}`}
      ref={popoverRef}
      style={position}
      role="dialog"
      aria-label="Save to playlist"
    >
      <div className="popover-head">
        <img src={track.thumbnail || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" loading="lazy" decoding="async" />
        <div><small>Save to playlist</small><strong title={track.title}>{track.title}</strong></div>
      </div>

      {!user ? <div className="popover-state popover-login">
        <p>Log in to save songs to your own playlists.</p>
        <button className="btn btn-primary btn-block" onClick={() => { close(); openAuth('login') }}><LogIn size={15} /> Log in</button>
        <button className="btn btn-block" onClick={() => { close(); openAuth('signup') }}><UserPlus size={15} /> Create an account</button>
      </div> : <>
        {playlistsError
          ? <p className="popover-state" role="alert">{playlistsError}</p>
          : !playlistsReady
            ? <TrackSkeletonList count={3} className="skeleton-popover-list" />
            : own.length === 0
              ? <p className="popover-state">You have no playlists yet. Name one below to save this song.</p>
              : <div className="popover-list" role="group" aria-label="Your playlists" onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
                  {own.map((playlist) => {
                    const has = playlist.tracks.some((item) => item.id === track.id)
                    const count = playlist.tracks.length
                    return <button
                      key={playlist.id}
                      className="popover-item"
                      role="checkbox"
                      aria-checked={has}
                      onClick={() => toggleTrack(playlist, has)}
                    >
                      <span className="popover-item-copy"><span>{playlist.name}</span><small>{count} {count === 1 ? 'song' : 'songs'}</small></span>
                      <span className="popover-check">{has ? <Check size={14} strokeWidth={3} /> : <Plus size={13} />}</span>
                    </button>
                  })}
                </div>}

        {playlistsReady && !playlistsError && <form className="popover-new" onSubmit={create}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New playlist name"
            aria-label="New playlist name"
            maxLength={60}
            data-autofocus={emptyLibrary ? '' : undefined}
          />
          <button className="btn btn-small btn-primary" type="submit" disabled={!name.trim() || creating}>
            {creating ? <Skeleton className="skeleton-button" /> : <Plus size={14} />} {creating ? 'Creating…' : 'Create'}
          </button>
        </form>}
      </>}

      {message && <p
        key={message.text}
        className={`popover-status motion-success${message.type === 'error' ? ' error' : ''}`}
        role={message.type === 'error' ? 'alert' : 'status'}
      >{message.type === 'ok' && <Check size={13} />} {message.text}</p>}
    </div>
  </>, document.body)

  if (hideButton) return portal || null

  return <div className="popover-wrap" ref={wrapRef}>
    <button
      ref={buttonRef}
      className={`icon-btn save-track-btn${saved ? ' is-saved' : ''}`}
      onClick={open ? close : openPopover}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={saved ? `Saved in ${savedCount} ${savedCount === 1 ? 'playlist' : 'playlists'}` : 'Add to playlist'}
    >
      <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
    </button>
    {portal}
  </div>
}

// Phone: bottom sheet. Desktop: anchored to the button, flipping above if there is no room below.
function getPosition(button) {
  if (!button) return null
  const rect = button.getBoundingClientRect()
  if (window.innerWidth <= 480) {
    return {
      top: 'auto', left: 8, right: 8, width: 'auto',
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      maxHeight: Math.min(window.innerHeight * 0.72, 520),
      transformOrigin: 'center bottom',
    }
  }
  const width = Math.min(300, window.innerWidth - 24)
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
  const spaceBelow = window.innerHeight - rect.bottom - 20
  const spaceAbove = rect.top - 20
  const flip = spaceBelow < 280 && spaceAbove > spaceBelow
  const originX = Math.max(0, Math.min(width, rect.left + rect.width / 2 - left))
  return flip
    ? { top: 'auto', bottom: window.innerHeight - rect.top + 8, left, width, maxHeight: Math.min(440, spaceAbove), transformOrigin: `${originX}px 100%` }
    : { top: rect.bottom + 8, bottom: 'auto', left, width, maxHeight: Math.min(440, spaceBelow), transformOrigin: `${originX}px 0` }
}

function friendlyError(error) {
  const code = error?.code || ''
  if (code === 'permission-denied') return 'Melojam couldn’t save this song. Try again in a moment.'
  if (code === 'unavailable') return 'Melojam couldn’t reach the server. Check your connection and try again.'
  if (code === 'unauthenticated' || /not logged in/i.test(error?.message || '')) return 'Your session may have expired. Log in again to save songs.'
  return 'Melojam couldn’t save this song. Try again.'
}
