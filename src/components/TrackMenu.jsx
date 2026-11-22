import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ListPlus, ListStart, MoreVertical, Play, Plus, Trash2 } from 'lucide-react'
import AddToPlaylist from './AddToPlaylist'

// Generic 3-dot menu. items: [{ label, icon, onClick, danger, disabled }]
export function DotsMenu({ items, label = 'More options', buttonRef, className = 'icon-btn' }) {
  const innerRef = useRef(null)
  const anchor = buttonRef || innerRef
  const menuRef = useRef(null)
  const [pos, setPos] = useState(null)
  const open = Boolean(pos)

  const toggle = () => {
    if (open) { setPos(null); return }
    const rect = anchor.current?.getBoundingClientRect()
    if (!rect) return
    const width = 220
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const below = window.innerHeight - rect.bottom
    const flip = below < items.length * 44 + 16 && rect.top > below
    setPos(flip
      ? { bottom: window.innerHeight - rect.top + 6, left, width, transformOrigin: 'right bottom' }
      : { top: rect.bottom + 6, left, width, transformOrigin: 'right top' })
  }

  useEffect(() => {
    if (!open) return undefined
    const close = () => setPos(null)
    const onPointerDown = (event) => {
      if (menuRef.current?.contains(event.target) || anchor.current?.contains(event.target)) return
      close()
    }
    const onKey = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, anchor])

  return <>
    <button ref={anchor} className={className} onClick={toggle} aria-label={label} aria-haspopup="menu" aria-expanded={open} title="More options">
      <MoreVertical size={17} />
    </button>
    {open && createPortal(
      <div className="dots-menu" ref={menuRef} style={pos} role="menu">
        {items.map((item) => <button
          key={item.label}
          role="menuitem"
          className={`dots-item${item.danger ? ' danger' : ''}`}
          disabled={item.disabled}
          onClick={() => { setPos(null); item.onClick() }}
        >{item.icon}<span>{item.label}</span></button>)}
      </div>,
      document.body,
    )}
  </>
}

// Per-song menu. Every action is optional: pass only the handlers a screen needs.
//   onPlay    -> "Play now"
//   onQueue   -> "Add to queue" (receives the 3-dot button so the add animation can start there)
//   queued    -> shows "In queue" and disables the item
//   onPlayNext, onRemove -> as before (queue rows)
export default function TrackMenu({ track, onPlay, onQueue, queued = false, onPlayNext, onRemove, playNextDisabled }) {
  const buttonRef = useRef(null)
  const [playlistOpen, setPlaylistOpen] = useState(false)

  const items = []
  if (onPlay) items.push({ label: 'Play now', icon: <Play size={16} />, onClick: onPlay })
  if (onQueue) items.push({
    label: queued ? 'In queue' : 'Add to queue',
    icon: queued ? <Check size={16} /> : <Plus size={16} />,
    onClick: () => onQueue(buttonRef.current),
    disabled: queued,
  })
  items.push({ label: 'Add to playlist', icon: <ListPlus size={16} />, onClick: () => setPlaylistOpen(true) })
  if (onPlayNext) items.push({ label: 'Play next', icon: <ListStart size={16} />, onClick: onPlayNext, disabled: playNextDisabled })
  if (onRemove) items.push({ label: 'Remove from queue', icon: <Trash2 size={16} />, onClick: onRemove, danger: true })

  return <>
    <DotsMenu buttonRef={buttonRef} label={`More options for ${track.title}`} items={items} />
    <AddToPlaylist track={track} hideButton anchorRef={buttonRef} open={playlistOpen} onOpenChange={setPlaylistOpen} />
  </>
}