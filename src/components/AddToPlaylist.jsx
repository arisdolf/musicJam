import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Heart, Loader, LogIn, Plus, UserPlus } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'
import { rubberBandAtBounds } from '../utils/motion'

// Heart button + popover (desktop) / bottom sheet (phone).
// - Heart is filled when the song is already in one of your playlists.
// - Tap a playlist to add the song, tap again to remove it.
// - Logged-out users get a clear "log in" prompt instead of a surprise modal.
export default function AddToPlaylist({ track }) {
  const { user, openAuth, playlists, playlistsReady, playlistsError, createPlaylist, addToPlaylist, removeFromPlaylist } = useAccount()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'error', text }
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)

  const savedCount = user ? playlists.filter((playlist) => playlist.tracks.some((item) => item.id === track.id)).length : 0
  const saved = savedCount > 0
  const emptyLibrary = Boolean(user && playlistsReady && !playlistsError && playlists.length === 0)

  const openPopover = () => {
    setMessage(null)
    setPosition(getPosition(buttonRef.current))
    setMounted(true)
    setOpen(true)
  }

  const close = useCallback(() => setOpen(false), [])

  // Unmount once the exit animation has had time to finish.
  useEffect(() => {
    if (open || !mounted) return undefined
    const timer = setTimeout(() => setMounted(false), 260)
    return () => clearTimeout(timer)
  }, [open, mounted])

  // Outside click, Escape, and keeping the popover attached to the button.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (wrapRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    let frame = 0
    const reposition = () => {
      const button = buttonRef.current
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
  }, [open])

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
    // Optimistic: the playlist list updates instantly from the local Firestore cache.
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

    {mounted && createPortal(<>
      <div className={`popover-scrim${open ? '' : ' is-closing'}`} onClick={close} />
      <div
        className={`popover ${open ? 'popover-enter' : 'popover-exit'}`}
        ref={popoverRef}
        style={position}
        role="dialog"
        aria-label="Save to playlist"
      >
        <div className="popover-head">
          <img src={track.thumbnail || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" />
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
              ? <p className="popover-state"><Loader size={15} className="spin" /> Loading your playlists…</p>
              : playlists.length === 0
                ? <p className="popover-state">You have no playlists yet. Name one below to save this song.</p>
                : <div className="popover-list" role="group" aria-label="Your playlists" onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
                    {playlists.map((playlist) => {
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
              {creating ? <Loader size={14} className="spin" /> : <Plus size={14} />} Create
            </button>
          </form>}
        </>}

        {message && <p
          key={message.text}
          className={`popover-status motion-success${message.type === 'error' ? ' error' : ''}`}
          role={message.type === 'error' ? 'alert' : 'status'}
        >{message.type === 'ok' && <Check size={13} />} {message.text}</p>}
      </div>
    </>, document.body)}
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
  if (code === 'permission-denied') return 'The database refused this. Check your Firestore rules for users/{uid}/playlists.'
  if (code === 'unavailable') return 'You seem to be offline. It will save when you reconnect.'
  if (code === 'unauthenticated' || /not logged in/i.test(error?.message || '')) return 'Please log in again to save songs.'
  return error?.message || 'Could not save this song. Try again.'
}