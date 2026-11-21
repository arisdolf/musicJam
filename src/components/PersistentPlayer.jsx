import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSyncedLyrics, parseSyncedLyrics } from '../services/lyrics'
import { usePlayback } from '../features/playback/PlaybackContext'
import { useAccount } from '../features/account/AccountContext'
import { rubberBandAtBounds } from '../utils/motion'
import AddToPlaylist from './AddToPlaylist'
import { useDragReorder } from '../hooks/useDragReorder'
import { searchYouTube } from '../services/youtube'
import { playNext } from '../utils/queue'
import LikeButton from './LikeButton'
import TrackMenu from './TrackMenu'
import ConfirmModal from './ConfirmModal'
import { LyricsSkeleton, Skeleton } from './Skeleton'
import {
  ArrowLeft, Check, ChevronDown, Disc3, GripVertical, ListMusic, ListOrdered, LogIn, Mic2, MicOff, Minus, MoreVertical,
  Pause, Play, Plus, Repeat1, Search, Shuffle, SkipBack, SkipForward, Timer, TimerOff, Trash2, ListStart, ListPlus, X
} from 'lucide-react'

// 1 second of silence. Looping it keeps the phone treating this page as "playing media".
function makeSilentWav(seconds = 1, rate = 8000) {
  const samples = seconds * rate
  const buffer = new ArrayBuffer(44 + samples)
  const view = new DataView(buffer)
  const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)) }
  write(0, 'RIFF'); view.setUint32(4, 36 + samples, true); write(8, 'WAVE')
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true)
  write(36, 'data'); view.setUint32(40, samples, true)
  new Uint8Array(buffer, 44).fill(128) // 8-bit silence
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

const YOUTUBE_READY_EVENT = 'onYouTubeIframeAPIReady'
const OFFSET_KEY = 'jamroom:lyric-offset:'
const SHOW_LYRICS_KEY = 'jamroom:show-lyrics'
const PLAY_MODE_KEY = 'jamroom:play-mode'
const LYRIC_TICK_MS = 100
const LYRIC_LEAD = 0.2     // show each line a touch early, like most lyric apps, so it never feels late
const OFFSET_STEP = 0.2    // seconds per tap on the timing buttons
const SLEEP_OPTIONS = [5, 10, 15, 30, 45, 60] // minutes
const SWIPE_MIN = 50       // px of horizontal travel that counts as a swipe

const MODE_ORDER = ['order', 'repeat', 'shuffle']
const MODES = {
  order: { label: 'Playing in order', icon: ListOrdered },
  repeat: { label: 'Repeating this song', icon: Repeat1 },
  shuffle: { label: 'Shuffle on', icon: Shuffle },
}

// Room sync: how far (seconds) this device may drift from the room clock before we seek.
const DRIFT_PLAYING = 1.5
const DRIFT_PAUSED = 0.4
const DRIFT_CHECK_MS = 4000
const SEEK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

function readOffset(trackId) {
  try { return Number(localStorage.getItem(OFFSET_KEY + trackId)) || 0 } catch { return 0 }
}

// Lyrics are on unless the listener switched them off.
function readShowLyrics() {
  try { return localStorage.getItem(SHOW_LYRICS_KEY) !== '0' } catch { return true }
}

function readMode() {
  try {
    const saved = localStorage.getItem(PLAY_MODE_KEY)
    return MODES[saved] ? saved : 'order'
  } catch { return 'order' }
}

const RESUME_KEY = 'jamroom:resume'

function readResume() {
  try {
    const saved = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null')
    return saved?.id && Number.isFinite(saved.time) ? saved : null
  } catch { return null }
}


// `sync` is { now() } while a room drives playback (null for local listening). It makes the player
// follow the room's shared position, so someone joining mid-song lands at the same part.
export default function PersistentPlayer({ playback, onPlaybackChange, onNavigate, onPlayTrack, onQueueTrack, onPlayNext, sync }) {
  const { registerPlayer } = usePlayback()
  const { user, openAuth } = useAccount()
  const [ytState, setYtState] = useState(-1)
  const ytStateTimer = useRef(0)
  const [playlistOpen, setPlaylistOpen] = useState(false)
const moreRef = useRef(null)
  const userPauseRef = useRef(0) // when the listener last paused on purpose
  const [playerReady, setPlayerReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState('player')        // 'player' | 'queue' | 'search'
  const [lyricsFull, setLyricsFull] = useState(false)
  const [showLyrics, setShowLyrics] = useState(readShowLyrics)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lyricsState, setLyricsState] = useState({ key: '', record: null, error: '' })
  const [active, setActive] = useState({ key: '', index: -1 })
  const [offsets, setOffsets] = useState({})
  const [mode, setMode] = useState(readMode)
  const [modeToast, setModeToast] = useState(null)
  const [menuPage, setMenuPage] = useState('main') // 'main' | 'timer'
  const [sleepEnd, setSleepEnd] = useState(null)   // timestamp (ms) when playback stops, or null
  const [sleepLeft, setSleepLeft] = useState(0)     // seconds remaining
  const [queueExiting, setQueueExiting] = useState(false)
  const playerHostRef = useRef(null)
  const [clearOpen, setClearOpen] = useState(false)
  const playerRef = useRef(null)
  const requestedVideoRef = useRef(null)
  const hasPlayedRef = useRef(false)
  const lyricLineRefs = useRef([])
  const lyricsListRef = useRef(null)
  const queueTimerRef = useRef(0)
  const stageRef = useRef(null)
  const overlayRef = useRef(null)
  const cardRef = useRef(null)
  const changePlayingRef = useRef(null)
  const [slideDir, setSlideDir] = useState(null) // which side the next page slides in from
  const callbacksRef = useRef({ playback, onPlaybackChange, sync, mode })

  const playbackQueue = playback.queue
  const playbackCurrent = playback.current
  const playbackPlaying = playback.playing
  const syncStamp = playback.syncedAt
  const showPause = playerReady && playbackPlaying && (ytState === 1 || ytState === 3)
  const currentTrack = playbackQueue[playbackCurrent] || null
  const currentTrackId = currentTrack?.id
  const hasCurrentTrack = Boolean(currentTrackId)
  const currentTrackLyricsId = currentTrack?.lyricsId
  const currentTrackTitle = currentTrack?.title
  const currentTrackArtist = currentTrack?.artist
  const currentTrackDuration = currentTrack?.duration
  const currentTrackThumbnail = currentTrack?.thumbnail
  const art = currentTrackId ? (currentTrackThumbnail || `https://i.ytimg.com/vi/${currentTrackId}/mqdefault.jpg`) : ''
  const lyricsKey = currentTrack ? [currentTrackId, currentTrackLyricsId || '', currentTrackTitle || '', currentTrackArtist || ''].join('|') : ''
  const lyricsRecord = lyricsState.key === lyricsKey ? lyricsState.record : null
  const lyricsLoading = Boolean(showLyrics && currentTrack && lyricsState.key !== lyricsKey)
  const lyricsError = lyricsState.key === lyricsKey ? lyricsState.error : ''
  const lyricsRecordId = lyricsRecord ? String(lyricsRecord.id) : ''
  const fullOpen = expanded && Boolean(currentTrack)
  const lyricsFullOn = showLyrics && lyricsFull
  const lyricsOpen = fullOpen && view === 'player' && lyricsFullOn
  // With lyrics switched off there are no lines at all, so nothing syncs, scrolls or shows in the mini bar.
  const lyricLines = useMemo(() => parseSyncedLyrics(showLyrics ? lyricsRecord?.syncedLyrics : ''), [showLyrics, lyricsRecord])
  const activeLyricIndex = lyricsRecordId && active.key === lyricsRecordId ? active.index : -1
  const lyricOffset = currentTrackId ? (offsets[currentTrackId] ?? readOffset(currentTrackId)) : 0
  const currentLyricText = showLyrics && activeLyricIndex >= 0 ? lyricLines[activeLyricIndex]?.text : ''

  const collapse = useCallback(() => {
  setExpanded(false); setMenuOpen(false); setView('player'); setQueueExiting(false); setPlaylistOpen(false)
}, [])

  const toggleLyrics = () => {
    const next = !showLyrics
    setShowLyrics(next)
    if (!next) setLyricsFull(false)
    try { localStorage.setItem(SHOW_LYRICS_KEY, next ? '1' : '0') } catch { /* storage is optional */ }
  }

  // Cycles order -> repeat -> shuffle and flashes a small pill with the new mode.
  const cycleMode = () => {
    const next = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length]
    setMode(next)
    setModeToast({ key: Date.now(), label: MODES[next].label, icon: MODES[next].icon })
    try { localStorage.setItem(PLAY_MODE_KEY, next) } catch { /* storage is optional */ }
  }

  const startSleep = (minutes) => {
    setSleepEnd(Date.now() + minutes * 60000)
    setSleepLeft(minutes * 60)
    setModeToast({ key: Date.now(), label: `Sleep timer: ${minutes} min`, icon: Timer })
    setMenuOpen(false)
  }
  const cancelSleep = () => {
    setSleepEnd(null)
    setModeToast({ key: Date.now(), label: 'Sleep timer off', icon: TimerOff })
    setMenuOpen(false)
  }

  // Queue panel eases in on open and out on close (the view switches after the exit animation).
  const closeQueue = useCallback(() => {
    setQueueExiting(true)
    clearTimeout(queueTimerRef.current)
    queueTimerRef.current = setTimeout(() => { setView('player'); setQueueExiting(false) }, 220)
  }, [])

  const toggleQueue = () => {
    setMenuOpen(false)
    if (view === 'queue' && !queueExiting) closeQueue()
    else { clearTimeout(queueTimerRef.current); setQueueExiting(false); setView('queue') }
  }

  // Swipe the artwork: the page follows your finger, then slides out and the other page slides in.
  const pageRef = useRef({ showLyrics, lyricsFullOn })
  useEffect(() => { pageRef.current = { showLyrics, lyricsFullOn } })

  const showPage = (toLyrics) => { setSlideDir(toLyrics ? 'right' : 'left'); setLyricsFull(toLyrics) }

  const startSwipe = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (!event.currentTarget.contains(event.target) || event.target.closest?.('button, input, a, [role="button"]')) return
    const stage = stageRef.current
    if (!stage) return
    const startX = event.clientX
    const startY = event.clientY
    let dragging = false
    let dx = 0
    // Left is only allowed from the cover (to lyrics), right only from lyrics (back to cover).
    const canGo = (delta) => {
      const page = pageRef.current
      return delta < 0 ? page.showLyrics && !page.lyricsFullOn : page.lyricsFullOn
    }
    const move = (e) => {
      dx = e.clientX - startX
      if (!dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - startY)) return
        dragging = true
      }
      const pull = canGo(dx) ? dx : dx * 0.25 // rubber band when there is nothing that way
      stage.style.transition = 'none'
      stage.style.transform = `translateX(${pull}px)`
      stage.style.opacity = String(1 - Math.min(Math.abs(pull) / 320, 0.6))
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (!dragging) return
      const clear = () => { stage.style.transition = ''; stage.style.transform = ''; stage.style.opacity = '' }
      if (Math.abs(dx) >= SWIPE_MIN && canGo(dx)) {
        const toLyrics = dx < 0
        stage.style.transition = 'transform 150ms var(--ease-in-out), opacity 150ms var(--ease-in-out)'
        stage.style.transform = `translateX(${toLyrics ? -56 : 56}px)`
        stage.style.opacity = '0'
        setTimeout(() => { clear(); showPage(toLyrics) }, 140)
      } else {
        stage.style.transition = 'transform 320ms var(--ease-in-out), opacity 320ms var(--ease-in-out)'
        stage.style.transform = ''
        stage.style.opacity = ''
        setTimeout(clear, 330)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const startDismissSwipe = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target.closest?.('button, input, a, [role="button"], .np-lyrics-list, .np-search, .np-queue-list, .np-drag-handle')) return
    const card = cardRef.current
    const overlay = overlayRef.current
    if (!card || !overlay) return
    const startX = event.clientX
    const startY = event.clientY
    let dragging = false
    let dy = 0

    const move = (moveEvent) => {
      const dx = moveEvent.clientX - startX
      dy = moveEvent.clientY - startY
      if (!dragging) {
        if (dy < 8 || dy < Math.abs(dx)) return
        dragging = true
      }
      const pull = Math.max(0, dy)
      card.style.transition = 'none'
      card.style.transform = `translateY(${pull}px)`
      card.style.opacity = String(1 - Math.min(pull / 480, 0.55))
      overlay.style.backgroundColor = `rgba(4,8,10,${Math.max(0.12, 0.6 - pull / 520)})`
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (!dragging) return
      const reset = () => {
        card.style.transition = ''
        card.style.transform = ''
        card.style.opacity = ''
        overlay.style.backgroundColor = ''
      }
      if (dy > 88) {
        card.style.transition = 'transform 180ms var(--ease-out), opacity 180ms var(--ease-out)'
        card.style.transform = 'translateY(100%)'
        card.style.opacity = '0'
        overlay.style.transition = 'background-color 180ms var(--ease-out)'
        overlay.style.backgroundColor = 'rgba(4,8,10,0)'
        setTimeout(() => { reset(); collapse() }, 185)
      } else {
        card.style.transition = 'transform 240ms var(--ease-out), opacity 240ms var(--ease-out)'
        card.style.transform = ''
        card.style.opacity = ''
        overlay.style.transition = 'background-color 240ms var(--ease-out)'
        overlay.style.backgroundColor = ''
        setTimeout(() => {
          reset()
          overlay.style.transition = ''
        }, 250)
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  // Swipe the mini player: left = next song, right = previous song (like Spotify).
  const miniRef = useRef(null)
  const swipedRef = useRef(false)
  const startMiniSwipe = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target.closest?.('.mini-play, .icon-btn')) return // let the buttons work normally
    const bar = miniRef.current
    if (!bar) return
    const startX = event.clientX
    const startY = event.clientY
    let dragging = false

    let dx = 0
    const canGo = (delta) => delta < 0 ? canNext : canPrev

    const move = (e) => {
      dx = e.clientX - startX
      if (!dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - startY)) return
        dragging = true
        swipedRef.current = true
      }
      const pull = canGo(dx) ? dx : dx * 0.25 // rubber band if there is no song that way
      bar.style.transition = 'none'
      bar.style.transform = `translateX(${pull}px)`
      bar.style.opacity = String(1 - Math.min(Math.abs(pull) / 260, 0.5))
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      setTimeout(() => { swipedRef.current = false }, 50)
      if (!dragging) return
      const reset = () => { bar.style.transition = ''; bar.style.transform = ''; bar.style.opacity = '' }
      if (Math.abs(dx) >= SWIPE_MIN && canGo(dx)) {
        const next = dx < 0
        bar.style.transition = 'transform 140ms var(--ease-in-out), opacity 140ms var(--ease-in-out)'
        bar.style.transform = `translateX(${next ? -90 : 90}px)`
        bar.style.opacity = '0'
        setTimeout(() => {
          playIndex(next ? nextIndex() : playbackCurrent - 1)
          // come back in from the opposite side
          bar.style.transition = 'none'
          bar.style.transform = `translateX(${next ? 90 : -90}px)`
          requestAnimationFrame(() => {
            bar.style.transition = 'transform 220ms var(--ease-out), opacity 220ms var(--ease-out)'
            bar.style.transform = ''
            bar.style.opacity = ''
            setTimeout(reset, 240)
          })
        }, 140)
      } else {
        bar.style.transition = 'transform 260ms var(--ease-in-out), opacity 260ms var(--ease-in-out)'
        bar.style.transform = ''
        bar.style.opacity = ''
        setTimeout(reset, 270)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }


  // ── Room sync helpers ──────────────────────────────────────────────────────
  // The real playhead, or undefined if the player has not started (so we never broadcast a fake 0:00).
  const livePosition = useCallback(() => {
    const player = playerRef.current
    const state = player?.getPlayerState?.()
    if (state !== 1 && state !== 2 && state !== 3) return undefined
    const time = Number(player.getCurrentTime?.())
    return Number.isFinite(time) ? time : undefined
  }, [])

  // Where the room says this song is right now. null = not in a room / not about this song.
  const syncTarget = useCallback((trackId) => {
    const { playback: latest, sync: link } = callbacksRef.current
    if (!link || !latest.syncedAt) return null
    if (latest.queue[latest.current]?.id !== trackId) return null
    const elapsed = latest.playing ? Math.max(0, link.now() - latest.syncedAt) / 1000 : 0
    return Math.max(0, (latest.position || 0) + elapsed)
  }, [])

  // Seek only when we have drifted noticeably, so normal playback is never interrupted.
  const followRoom = useCallback((player, trackId) => {
    const target = syncTarget(trackId)
    if (target === null) return
    const limit = callbacksRef.current.playback.playing ? DRIFT_PLAYING : DRIFT_PAUSED
    const time = Number(player.getCurrentTime?.() || 0)
    if (Math.abs(time - target) > limit) {
      try { player.seekTo(target, true) } catch { /* player not ready */ }
    }
  }, [syncTarget])

  const requestVideo = useCallback((track, shouldPlay = true) => {
    const player = playerRef.current
    if (!track?.id || !player) return
    if (player.getVideoData?.()?.video_id === track.id) {
      if (shouldPlay) { followRoom(player, track.id); player.playVideo() }
      else player.pauseVideo()
      return
    }
    requestedVideoRef.current = track.id
    hasPlayedRef.current = false
    const startSeconds = syncTarget(track.id) ?? 0
    if (shouldPlay) player.loadVideoById({ videoId: track.id, startSeconds })
    else player.cueVideoById({ videoId: track.id, startSeconds })
  }, [followRoom, syncTarget])

  const playIndex = useCallback((index) => {
    const track = playbackQueue[index]
    if (!track) return
    onPlaybackChange((state) => ({ ...state, current: index, playing: true }))
    requestVideo(track)
  }, [onPlaybackChange, playbackQueue, requestVideo])

  // Index the "next" button should go to (random when shuffle is on).
  const nextIndex = useCallback(() => {
    const length = playbackQueue.length
    if (mode === 'shuffle' && length > 1) {
      let pick = playbackCurrent
      while (pick === playbackCurrent) pick = Math.floor(Math.random() * length)
      return pick
    }
    return playbackCurrent + 1
  }, [mode, playbackQueue.length, playbackCurrent])

  const changePlaying = useCallback((playing) => {
    if (!playing) userPauseRef.current = Date.now()
    const track = playbackQueue[playbackCurrent]
    if (!track) return
    onPlaybackChange((state) => ({ ...state, playing }), { position: livePosition() })
    if (playing) requestVideo(track)
    else playerRef.current?.pauseVideo?.()
  }, [onPlaybackChange, playbackCurrent, playbackQueue, requestVideo, livePosition])

  const mediaActionsRef = useRef(null)
  mediaActionsRef.current = {
    play: () => changePlaying(true),
    pause: () => changePlaying(false),
    previoustrack: () => playIndex(playbackCurrent - 1),
    nexttrack: () => playIndex(nextIndex()),
    seekbackward: () => {
      const time = Math.max(0, Number(playerRef.current?.getCurrentTime?.() || 0) - 10)
      try { playerRef.current?.seekTo?.(time, true) } catch { /* player not ready */ }
      seekRoom(time)
    },
    seekforward: () => {
      const time = Math.max(0, Number(playerRef.current?.getCurrentTime?.() || 0) + 10)
      try { playerRef.current?.seekTo?.(time, true) } catch { /* player not ready */ }
      seekRoom(time)
    },
    seekto: (details) => {
      try { playerRef.current?.seekTo?.(details.seekTime, true) } catch { /* player not ready */ }
      seekRoom(details.seekTime)
    },
  }

  const resumeRef = useRef(undefined) // where the last session stopped; used once, on the first load
  if (resumeRef.current === undefined) resumeRef.current = readResume()

  // Tell the room where the playhead was moved to.
  const seekRoom = useCallback((seconds) => {
    onPlaybackChange((state) => state, { position: seconds })
  }, [onPlaybackChange])

  // If the browser blocked autoplay, the first click should actually start the video.
  const togglePlay = () => {
    const state = playerRef.current?.getPlayerState?.()
    if (playbackPlaying && (state === -1 || state === 5) && currentTrack) {
      requestVideo(currentTrack, true)
      return
    }
    changePlaying(!playbackPlaying)
  }

  const removeTrack = useCallback((index) => onPlaybackChange((state) => {
    const queue = state.queue.filter((_, itemIndex) => itemIndex !== index)
    const current = queue.length ? Math.min(state.current > index ? state.current - 1 : state.current, queue.length - 1) : 0
    return { ...state, queue, current, playing: queue.length ? state.playing : false }
  }), [onPlaybackChange])

  const clearQueue = () => {
    setClearOpen(false)
    onPlaybackChange((state) => ({ ...state, queue: [], current: 0, playing: false }))
  }

  useEffect(() => {
    if (!playerReady || currentTrackId) return
    try { playerRef.current?.stopVideo?.() } catch { /* not ready */ }
    collapse()
  }, [playerReady, currentTrackId, collapse])


  const moveTrack = useCallback((from, to) => onPlaybackChange((state) => {
    if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return state
    const currentId = state.queue[state.current]?.id
    const queue = [...state.queue]
    const [track] = queue.splice(from, 1)
    queue.splice(to, 0, track)
    return { ...state, queue, current: Math.max(0, queue.findIndex((item) => item.id === currentId)) }
  }), [onPlaybackChange])
  const queueDrag = useDragReorder(moveTrack)

  // Queue view: keep the current song near the top, with the previous song above it.
  useEffect(() => {
    if (view !== 'queue') return
    const list = queueDrag.listRef.current
    const row = list?.children[Math.max(0, playbackCurrent - 1)]
    if (!list || !row) return
    const top = list.scrollTop + row.getBoundingClientRect().top - list.getBoundingClientRect().top
    list.scrollTo({ top, behavior: 'smooth' })
  }, [view, playbackCurrent, queueDrag.listRef])

  const saveOffset = (next) => {
    if (!currentTrackId) return
    setOffsets((current) => ({ ...current, [currentTrackId]: next }))
    try {
      if (next) localStorage.setItem(OFFSET_KEY + currentTrackId, String(next))
      else localStorage.removeItem(OFFSET_KEY + currentTrackId)
    } catch { /* storage is optional */ }
  }
  const nudgeOffset = (delta) => saveOffset(Math.round((lyricOffset + delta) * 10) / 10)

  const go = (id) => { onNavigate?.(id); collapse() }

  useEffect(() => { callbacksRef.current = { playback, onPlaybackChange, sync, mode } }, [playback, onPlaybackChange, sync, mode])

  useEffect(() => {
    if (!fullOpen) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      if (menuOpen) setMenuOpen(false)
      else collapse()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullOpen, menuOpen, collapse])

  useEffect(() => { changePlayingRef.current = changePlaying })

  // Sleep timer: counts down, then pauses the music.
  useEffect(() => {
    if (!sleepEnd) return undefined
    const timer = setInterval(() => {
      const left = Math.ceil((sleepEnd - Date.now()) / 1000)
      if (left > 0) { setSleepLeft(left); return }
      setSleepEnd(null)
      changePlayingRef.current?.(false)
      setModeToast({ key: Date.now(), label: 'Sleep timer ended. Music paused', icon: Timer })
    }, 1000)
    return () => clearInterval(timer)
  }, [sleepEnd])

  useEffect(() => { if (!menuOpen) setMenuPage('main') }, [menuOpen])

  // Hide the mode pill after its animation finishes.
  useEffect(() => {
    if (!modeToast) return undefined
    const timer = setTimeout(() => setModeToast(null), 1700)
    return () => clearTimeout(timer)
  }, [modeToast])

  useEffect(() => () => { clearTimeout(queueTimerRef.current); clearTimeout(ytStateTimer.current) }, [])

  // ── YouTube player (kept alive but hidden: audio only) ─────────────────────
  useEffect(() => {
    let cancelled = false
    const host = playerHostRef.current

    const createPlayer = () => {
      if (cancelled || !host || !window.YT?.Player || playerRef.current) return
      const mount = document.createElement('div')
      host.appendChild(mount)
      playerRef.current = new window.YT.Player(mount, {
        width: '100%',
        height: '100%',
        playerVars: { origin: window.location.origin, playsinline: 1, rel: 0, controls: 0, disablekb: 1, iv_load_policy: 3 },
        events: {
          onReady: () => {
            const player = playerRef.current
            if (cancelled || !player) return
            registerPlayer({
              getVideoData: () => player.getVideoData?.(),
              getCurrentTime: () => player.getCurrentTime?.(),
              getPlayerState: () => player.getPlayerState?.(),
              playVideo: () => player.playVideo(),
              pauseVideo: () => player.pauseVideo(),
              loadVideoById: (videoId) => {
                requestedVideoRef.current = videoId
                hasPlayedRef.current = false
                player.loadVideoById(videoId)
              },
            })
            setPlayerReady(true)
          },
          onStateChange: (event) => {
            clearTimeout(ytStateTimer.current)
            if (event.data === -1) ytStateTimer.current = setTimeout(() => setYtState(-1), 700)
            else setYtState(event.data)
            if (event.data === 1 || event.data === 3) requestedVideoRef.current = null
            if (event.data === 1) hasPlayedRef.current = true
            const latest = callbacksRef.current
            if (event.data === 1 && !latest.playback.playing) {
              latest.onPlaybackChange((state) => ({ ...state, playing: true }), { position: livePosition() })
            }
            if (event.data === 2 && latest.playback.playing && hasPlayedRef.current) {
              latest.onPlaybackChange((state) => ({ ...state, playing: false }), { position: livePosition() })
            }
            if (event.data === 0) {
              try { localStorage.removeItem(RESUME_KEY) } catch { /* storage is optional */ }

              // Every device sees the song end. Only advance if the room is still on the song that ended,
              // otherwise a joiner would skip an extra track.
              const endedId = event.target?.getVideoData?.()?.video_id
              const { queue, current } = latest.playback
              if (latest.mode === 'repeat') {
                try { event.target.seekTo(0, true); event.target.playVideo() } catch { /* player not ready */ }
                latest.onPlaybackChange((state) => state, { position: 0 })
              } else if (latest.mode === 'shuffle') {
                latest.onPlaybackChange((state) => {
                  if (endedId && state.queue[state.current]?.id !== endedId) return state
                  if (state.queue.length < 2) return { ...state, playing: false }
                  let next = state.current
                  while (next === state.current) next = Math.floor(Math.random() * state.queue.length)
                  return { ...state, current: next, playing: true }
                }, queue.length < 2 ? { position: 0 } : undefined)
              } else {
                latest.onPlaybackChange((state) => {
                  if (endedId && state.queue[state.current]?.id !== endedId) return state
                  return state.current < state.queue.length - 1
                    ? { ...state, current: state.current + 1, playing: true }
                    : { ...state, playing: false }
                }, current >= queue.length - 1 ? { position: 0 } : undefined)
              }
            }
          },
          onError: (event) => {
            requestedVideoRef.current = null
            const failedId = event.target?.getVideoData?.()?.video_id
            callbacksRef.current.onPlaybackChange((state) => {
              if (failedId && state.queue[state.current]?.id !== failedId) return state
              return state.current < state.queue.length - 1
                ? { ...state, current: state.current + 1, playing: true }
                : { ...state, playing: false }
            })
          },
        },
      })
    }

    if (window.YT?.Player) createPlayer()
    else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
      const previousCallback = window[YOUTUBE_READY_EVENT]
      window[YOUTUBE_READY_EVENT] = () => { previousCallback?.(); createPlayer() }
    }

    return () => {
      cancelled = true
      registerPlayer(null)
      try { playerRef.current?.destroy?.() } catch { /* already gone */ }
      playerRef.current = null
      host?.replaceChildren()
      setPlayerReady(false)
      setYtState(-1)
    }
  }, [registerPlayer, livePosition])

  // Remember the playhead so a refresh continues from the same spot.
  useEffect(() => {
    if (!playerReady || !currentTrackId) return undefined
    const save = () => {
      const player = playerRef.current
      const state = player?.getPlayerState?.()
      if (state !== 1 && state !== 2) return
      if (player.getVideoData?.()?.video_id !== currentTrackId) return
      const time = Number(player.getCurrentTime?.())
      if (!Number.isFinite(time)) return
      try { localStorage.setItem(RESUME_KEY, JSON.stringify({ id: currentTrackId, time })) } catch { /* storage is optional */ }
    }
    const onHidden = () => { if (document.visibilityState === 'hidden') save() }
    const timer = setInterval(save, 2000)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [playerReady, currentTrackId])


  // Load / play / pause whatever the (local or room) state says. New songs start at the room's position.
  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || !player || !currentTrackId) return undefined

    try {
      if (player.getVideoData?.()?.video_id !== currentTrackId) {
        if (requestedVideoRef.current !== currentTrackId) {
          requestedVideoRef.current = currentTrackId
          hasPlayedRef.current = false
          const resume = resumeRef.current
          resumeRef.current = null // only the first load after a refresh resumes
          const resumeAt = resume && resume.id === currentTrackId ? resume.time : 0
          const startSeconds = syncTarget(currentTrackId) ?? resumeAt
          if (playbackPlaying) player.loadVideoById({ videoId: currentTrackId, startSeconds })
          else player.cueVideoById({ videoId: currentTrackId, startSeconds })
        }
      } else if (playbackPlaying) player.playVideo()
      else player.pauseVideo()
    } catch (error) {
      console.warn('YouTube player is not ready yet:', error)
    }

  }, [currentTrackId, playbackPlaying, playerReady, syncTarget])

  // Room sync 1/2: whenever anyone plays, pauses, seeks or changes song, jump to the shared position.
  useEffect(() => {
    if (!sync || !playerReady || !currentTrackId || !syncStamp) return
    const player = playerRef.current
    if (!player || player.getVideoData?.()?.video_id !== currentTrackId) return // the load effect handles new songs
    const state = player.getPlayerState?.()
    if (state !== 1 && state !== 2 && state !== 3) return // not started yet (autoplay blocked): starts at the right spot on first tap
    followRoom(player, currentTrackId)
  }, [sync, playerReady, currentTrackId, syncStamp, playbackPlaying, followRoom])



  // Lock-screen / notification controls show the right play or pause state.

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = showPause ? 'playing' : 'paused'
  }, [showPause])






  // Room sync 2/2: while playing, quietly correct drift (buffering, background tabs) every few seconds.
  useEffect(() => {
    if (!sync || !playerReady || !currentTrackId || !playbackPlaying) return undefined
    const timer = setInterval(() => {
      const player = playerRef.current
      if (!player || player.getPlayerState?.() !== 1) return
      if (player.getVideoData?.()?.video_id !== currentTrackId) return
      followRoom(player, currentTrackId)
    }, DRIFT_CHECK_MS)
    return () => clearInterval(timer)
  }, [sync, playerReady, currentTrackId, playbackPlaying, followRoom])

  // ── Lyrics fetch (skipped entirely while lyrics are switched off) ──────────
  useEffect(() => {
    if (!showLyrics || !lyricsKey) return undefined
    const controller = new AbortController()
    getSyncedLyrics({
      id: currentTrackId,
      lyricsId: currentTrackLyricsId,
      title: currentTrackTitle,
      artist: currentTrackArtist,
      duration: currentTrackDuration,
    }, controller.signal)
      .then((record) => {
        if (!controller.signal.aborted) {
          setLyricsState({ key: lyricsKey, record, error: record ? '' : 'No synced lyrics for this song.' })
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setLyricsState({ key: lyricsKey, record: null, error: error.message || 'Could not load synced lyrics.' })
        }
      })
    return () => controller.abort()
  }, [showLyrics, lyricsKey, currentTrackId, currentTrackLyricsId, currentTrackTitle, currentTrackArtist, currentTrackDuration])

  // ── Lyric sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || !player || !lyricLines.length || !lyricsRecordId) return undefined

    // YouTube only refreshes getCurrentTime a few times a second, so reading it directly makes lines
    // show late and jump. Between refreshes we extend the last reading with a wall clock (only while
    // playing), and any real change in the reading (seek, buffering, restart) resets that anchor.
    let anchor = { time: -1, at: 0 }
    const clock = () => {
      const raw = Number(player.getCurrentTime?.() || 0)
      const now = performance.now()
      if (raw !== anchor.time) anchor = { time: raw, at: now }
      if (player.getPlayerState?.() !== 1) return raw
      const rate = Number(player.getPlaybackRate?.()) || 1
      return anchor.time + Math.min(0.6, (now - anchor.at) / 1000) * rate
    }

    const tick = () => {
      const index = findLyricIndex(lyricLines, clock() - lyricOffset + LYRIC_LEAD)
      setActive((previous) => previous.key === lyricsRecordId && previous.index === index
        ? previous
        : { key: lyricsRecordId, index })
    }
    tick()
    const timer = setInterval(tick, LYRIC_TICK_MS)
    return () => clearInterval(timer)
  }, [playerReady, lyricLines, lyricsRecordId, lyricOffset])

  useEffect(() => {
    const list = lyricsListRef.current
    const line = lyricLineRefs.current[activeLyricIndex]
    if (!lyricsOpen || !list || !line) return
    list.scrollTo({ top: line.offsetTop - list.clientHeight / 2 + line.offsetHeight / 2, behavior: 'smooth' })
  }, [activeLyricIndex, lyricsOpen])

  useEffect(() => {
    if (!currentTrackId || !('mediaSession' in navigator)) return undefined
    if ('MediaMetadata' in window) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrackTitle,
        artist: currentTrackArtist,
        album: 'Jamroom', // shown under the artist on some phones
        artwork: [
          { src: `https://i.ytimg.com/vi/${currentTrackId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
          { src: `https://i.ytimg.com/vi/${currentTrackId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
        ],
      })
    }
  }, [currentTrackId, currentTrackTitle, currentTrackArtist])

  // Install transport controls once per active playback session. Re-registering them on every
  // queue update can make browsers drop the skip buttons from their system media notification.
  useEffect(() => {
    if (!hasCurrentTrack || !('mediaSession' in navigator)) return undefined
    const actions = Object.keys(mediaActionsRef.current)
    for (const action of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, (...args) => mediaActionsRef.current[action](...args))
      } catch { /* unsupported action */ }
    }
    return () => {
      for (const action of actions) {
        try { navigator.mediaSession.setActionHandler(action, null) } catch { /* noop */ }
      }
    }
  }, [hasCurrentTrack])


  // Keeps the lock-screen progress bar in step with the song.
  useEffect(() => {
    if (!playerReady || !currentTrackId || !('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return undefined
    const update = () => {
      const player = playerRef.current
      const duration = Number(player?.getDuration?.())
      const position = Number(player?.getCurrentTime?.())
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return
      try {
        navigator.mediaSession.setPositionState({ duration, position: Math.min(position, duration), playbackRate: 1 })
      } catch { /* not supported */ }
    }
    update()
    const timer = setInterval(update, 3000)
    return () => clearInterval(timer)
  }, [playerReady, currentTrackId, playbackPlaying])


  const offsetLabel = `${lyricOffset > 0 ? '+' : ''}${lyricOffset.toFixed(1)}s`
  const lineAt = (index) => (index >= 0 && index < lyricLines.length ? lyricLines[index].text || '♪' : '')
  const windowLines = activeLyricIndex >= 0
    ? [lineAt(activeLyricIndex - 1), lineAt(activeLyricIndex), lineAt(activeLyricIndex + 1)]
    : ['', '♪', lineAt(0)]
  const canPrev = playbackCurrent > 0
  const canNext = mode === 'shuffle' ? playbackQueue.length > 1 : playbackCurrent < playbackQueue.length - 1
  const ModeIcon = MODES[mode].icon
  const ToastIcon = modeToast?.icon
  const sleepLabel = `${Math.floor(sleepLeft / 60)}:${String(sleepLeft % 60).padStart(2, '0')}`
  const queueActive = view === 'queue' && !queueExiting

  return <>
    {/* The video lives here, off-screen. Only its audio is used. */}
    <div className="yt-host" ref={playerHostRef} aria-hidden="true" />

    {currentTrack && !fullOpen && <div className="mini-player" ref={miniRef} onPointerDown={startMiniSwipe} role="region" aria-label="Music player">
      <button className="mini-open" onClick={() => { if (!swipedRef.current) setExpanded(true) }} aria-label={`Open player. Now playing ${currentTrack.title}`}>
        <img src={art} alt="" />
        <span className="mini-copy">
          <strong title={currentTrack.title}>{currentTrack.title}</strong>
          <small>{currentLyricText || currentTrack.artist}</small>
        </span>
      </button>
      <button className="icon-btn" onClick={() => playIndex(playbackCurrent - 1)} disabled={!canPrev} aria-label="Previous song"><SkipBack size={17} /></button>
      <button className="mini-play" onClick={togglePlay} aria-label={showPause ? 'Pause' : 'Play'}>
        <span key={showPause ? 'pause' : 'play'} className="motion-icon">{showPause ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</span>
      </button>
      <button className="icon-btn" onClick={() => playIndex(nextIndex())} disabled={!canNext} aria-label="Next song"><SkipForward size={17} /></button>
    </div>}

    {fullOpen && <div ref={overlayRef} className="np-overlay" role="dialog" aria-modal="true" aria-label="Now playing"
      onMouseDown={(event) => { if (event.target === event.currentTarget) collapse() }}>
      <section ref={cardRef} className="np-card">
        <div className="np-backdrop" style={{ backgroundImage: `url("${art}")` }} aria-hidden="true" />

        <header className="np-top" onPointerDown={startDismissSwipe}>
          <button
            className="np-icon"
            onClick={view === 'player' ? collapse : view === 'queue' ? closeQueue : () => setView('player')}
            aria-label={view === 'player' ? 'Close player' : 'Back to player'}
          >
            {view === 'player' ? <ChevronDown size={22} /> : <ArrowLeft size={20} />}
          </button>
          <span className="np-kicker">{view === 'queue' ? 'UP NEXT' : view === 'search' ? 'ADD MUSIC' : 'NOW PLAYING'}</span>
          <button
          ref={moreRef}
            className={`np-icon${menuOpen ? ' is-open' : ''}${sleepEnd ? ' has-timer' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          ><MoreVertical size={20} /></button>
        </header>

        {view === 'search'
          ? <SongSearch
            queuedIds={playbackQueue.map((track) => track.id)}
            onPlay={onPlayTrack}
            onQueue={onQueueTrack}
            onPlayNext={onPlayNext}
          />
          : view === 'queue'
            ? <ul ref={queueDrag.listRef} className={`np-queue-list ${queueExiting ? 'np-panel-out' : 'np-panel-in'}`} onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
              {playbackQueue.map((track, index) => <li
                className={`${index === playbackCurrent ? 'current' : ''}${queueDrag.dragIndex === index ? ' dragging' : ''}`}
                key={track.id}
                style={queueDrag.itemStyle(index)}
              >
                <span className="np-drag-handle" {...queueDrag.handleProps(index)} title="Drag to reorder" aria-label={`Drag ${track.title} to reorder`}><GripVertical size={17} /></span>
                <button className="np-queue-track" onClick={() => playIndex(index)}>
                  <img src={track.thumbnail || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" loading="lazy" decoding="async" />
                  <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                </button>
                <LikeButton track={track} />
                <TrackMenu
                  track={track}
                  playNextDisabled={index === playbackCurrent || index === playbackCurrent + 1}
                  onPlayNext={() => onPlaybackChange((state) => playNext(state, track))}
                  onRemove={() => removeTrack(index)}
                />

              </li>)}
            </ul>
            : <div className={`np-body${showLyrics ? '' : ' no-lyrics'}`} onPointerDown={(event) => { startSwipe(event); startDismissSwipe(event) }}>
              <div ref={stageRef} className={`np-stage${lyricsFullOn ? ' is-lyrics' : ''}${slideDir ? ` slide-from-${slideDir}` : ''}`}>
                {lyricsFullOn
                  ? <>
                    <div className="np-lyrics-bar">
                      <span>Synced lyrics</span>
                      {lyricLines.length > 0 && <div className="lyric-offset" role="group" aria-label="Adjust lyric timing">
                        <button onClick={() => nudgeOffset(-OFFSET_STEP)} aria-label="Show lyrics earlier" title="Lyrics late? Show them earlier"><Minus size={13} /></button>
                        <span
                          role="button"
                          tabIndex={0}
                          title="Lyric timing offset. Click to reset."
                          onClick={() => saveOffset(0)}
                          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); saveOffset(0) } }}
                        >{offsetLabel}</span>

                        <button onClick={() => nudgeOffset(OFFSET_STEP)} aria-label="Show lyrics later" title="Lyrics early? Show them later"><Plus size={13} /></button>
                      </div>}
                    </div>
                    {lyricsLoading && <div className="np-lyrics-note"><LyricsSkeleton /></div>}
                    {!lyricsLoading && lyricsError && <p className="np-lyrics-note">{lyricsError}</p>}
                    {!lyricsLoading && !lyricsError && <div className="np-lyrics-list" ref={lyricsListRef} onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
                      {lyricLines.map((line, index) => <p
                        key={`${line.time}-${index}`}
                        ref={(element) => { lyricLineRefs.current[index] = element }}
                        className={index === activeLyricIndex ? 'current' : ''}
                      >{line.text || '♪'}</p>)}
                    </div>}
                  </>
                  : <img key={currentTrackId} className="np-art" src={art} alt="" draggable={false} />}
              </div>

              {showLyrics && <div className="np-pager" role="group" aria-label="Cover or lyrics">
                <button className={!lyricsFullOn ? 'on' : ''} onClick={() => showPage(false)} aria-label="Show cover art" />
                <button className={lyricsFullOn ? 'on' : ''} onClick={() => showPage(true)} aria-label="Show lyrics" />
              </div>}

              <div className="np-title-row">
                <div className="np-title">
                  <strong title={currentTrack.title}>{currentTrack.title}</strong>
                  <small>{currentTrack.artist}</small>
                </div>
                <button
                  className={`icon-btn np-lyrics-toggle${showLyrics ? ' active' : ''}`}
                  onClick={toggleLyrics}
                  aria-pressed={showLyrics}
                  aria-label={showLyrics ? 'Turn lyrics off' : 'Turn lyrics on'}
                  title={showLyrics ? 'Lyrics on' : 'Lyrics off'}
                >{showLyrics ? <Mic2 size={17} /> : <MicOff size={17} />}</button>
                <LikeButton track={currentTrack} />
              </div>

              {showLyrics && !lyricsFullOn && <div className="np-lyric-window" aria-live="off">
                {lyricsLoading
                  ? <LyricsSkeleton />
                  : lyricsError
                    ? <p>{lyricsError}</p>
                    : windowLines.map((text, slot) => <p key={`${activeLyricIndex}:${slot}`} className={slot === 1 ? `current${text.length > 70 ? ' long' : ''}` : ''}>{text}</p>)}
              </div>}

              <ProgressBar key={currentTrackId} playerRef={playerRef} fallbackDuration={currentTrackDuration} onSeek={seekRoom} />
            </div>}

        <footer className="np-controls">
          <button
            className={`np-circle${mode !== 'order' ? ' active' : ''}`}
            onClick={cycleMode}
            aria-label={`${MODES[mode].label}. Tap to change playback mode`}
          ><ModeIcon size={17} /></button>
          <button className="np-icon" onClick={() => playIndex(playbackCurrent - 1)} disabled={!canPrev} aria-label="Previous song"><SkipBack size={22} fill="currentColor" /></button>
          <button className="np-play" onClick={togglePlay} aria-label={showPause ? 'Pause' : 'Play'}>
            <span key={showPause ? 'pause' : 'play'} className="motion-icon">{showPause ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}</span>
          </button>
          <button className="np-icon" onClick={() => playIndex(nextIndex())} disabled={!canNext} aria-label="Next song"><SkipForward size={22} fill="currentColor" /></button>
          <button className={`np-circle${queueActive ? ' active' : ''}`} onClick={toggleQueue} aria-label="Queue" aria-pressed={queueActive}><ListMusic size={17} /></button>
        </footer>

        {modeToast && <div key={modeToast.key} className="np-toast" role="status">
          <ToastIcon size={16} /> {modeToast.label}
        </div>}

        {menuOpen && <>
          <div className="np-menu-scrim" onClick={() => setMenuOpen(false)} />
          <div className="np-menu" role="menu">
            {menuPage === 'timer'
              ? <>

                <button role="menuitem" onClick={() => setMenuPage('main')}><ArrowLeft size={16} /> Sleep timer</button>
                {SLEEP_OPTIONS.map((minutes) => <button key={minutes} role="menuitem" onClick={() => startSleep(minutes)}>
                  <Timer size={16} /> {minutes} minutes
                </button>)}
                {sleepEnd && <button role="menuitem" onClick={cancelSleep}><TimerOff size={16} /> Turn off timer</button>}
              </>
              : <>
                <button role="menuitem" onClick={() => { setView('search'); setMenuOpen(false) }}><Search size={16} /> Add music</button>
                <button role="menuitem" onClick={() => { setMenuOpen(false); setPlaylistOpen(true) }}><ListPlus size={16} /> Add to playlist</button>
                {playbackQueue.length > 0 && <button role="menuitem" onClick={() => { setMenuOpen(false); setClearOpen(true) }}><Trash2 size={16} /> Remove all tracks</button>}
                <button role="menuitem" onClick={() => setMenuPage('timer')}>
                  <Timer size={16} /> Sleep timer {sleepEnd && <small>{sleepLabel}</small>}
                </button>

                {user
                  ? <>
                    <button role="menuitem" onClick={() => go('playlists')}><Disc3 size={16} /> My playlists</button>

                  </>
                  : <button role="menuitem" onClick={() => { collapse(); openAuth('login') }}><LogIn size={16} /> Log in to save music</button>}
              </>}
          </div>
        </>}
      </section>
    </div>}
    {clearOpen && <ConfirmModal
      title="Remove all tracks?"
      message="This clears your whole queue."
      confirmLabel="Remove all"
      onCancel={() => setClearOpen(false)}
      onConfirm={clearQueue}
    />}
    {fullOpen && <AddToPlaylist track={currentTrack} hideButton open={playlistOpen} onOpenChange={setPlaylistOpen} anchorRef={moreRef} />}

  </>
}

// Polls the player clock itself so only this small bar re-renders, not the whole player.
// onSeek(seconds) lets the room know when the listener moves the playhead.
function ProgressBar({ playerRef, fallbackDuration, onSeek }) {
  const [clock, setClock] = useState({ time: 0, duration: fallbackDuration || 0 })
  const [drag, setDrag] = useState(null)

  useEffect(() => {
    const tick = () => {
      const player = playerRef.current
      if (!player) return
      const time = Number(player.getCurrentTime?.() || 0)
      const duration = Number(player.getDuration?.() || 0) || fallbackDuration || 0
      setClock((previous) => Math.abs(previous.time - time) < 0.2 && previous.duration === duration ? previous : { time, duration })
    }
    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [playerRef, fallbackDuration])

  const commit = (value) => {
    if (Number.isFinite(value)) {
      try { playerRef.current?.seekTo?.(value, true) } catch { /* player not ready */ }
      onSeek?.(value)
      setClock((previous) => ({ ...previous, time: value }))
    }
    setDrag(null)
  }

  const shown = drag ?? clock.time
  const pct = clock.duration ? Math.min(100, (shown / clock.duration) * 100) : 0

  return <div className="np-progress">
    <input
      className="np-seek"
      type="range"
      min="0"
      max={clock.duration || 1}
      step="0.1"
      value={shown}
      disabled={!clock.duration}
      aria-label="Seek"
      style={{ '--pct': `${pct}%` }}
      onChange={(event) => setDrag(Number(event.target.value))}
      onPointerUp={(event) => commit(Number(event.currentTarget.value))}
      onPointerCancel={() => setDrag(null)}
      onKeyUp={(event) => { if (SEEK_KEYS.has(event.key)) commit(Number(event.currentTarget.value)) }}
    />
    <div className="np-times"><span>{formatTime(shown)}</span><span>{formatTime(clock.duration)}</span></div>
  </div>
}

function formatTime(seconds = 0) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function findLyricIndex(lines, currentTime) {
  let low = 0
  let high = lines.length - 1
  let result = -1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (lines[middle].time <= currentTime) { result = middle; low = middle + 1 }
    else high = middle - 1
  }
  return result
}

function SongSearch({ queuedIds, onPlay, onQueue, onPlayNext }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const [state, setState] = useState({ query: '', results: [], searching: false, error: '' })
  const q = query.trim()
  const hasResult = state.query === q
  const results = hasResult ? state.results : []
  const searching = Boolean(q && (!hasResult || state.searching))
  const error = hasResult ? state.error : ''

  useEffect(() => {
    if (!q) return undefined
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState({ query: q, results: [], searching: true, error: '' })
      try {
        const tracks = await searchYouTube(q, controller.signal)
        if (!controller.signal.aborted) {
          setState({ query: q, results: tracks, searching: false, error: tracks.length ? '' : 'No songs found. Try another search.' })
        }
      } catch (err) {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          setState({ query: q, results: [], searching: false, error: err.message || 'Song search failed.' })
        }
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [q])

  return <div className="np-search">
    <div className="np-search-input">
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search songs or artists"
        aria-label="Search songs or artists"
        autoFocus
      />
      <button type="button" className="np-search-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }} disabled={!query} aria-label="Clear song search"><X size={17} /></button>
    </div>
    <ul className="np-queue-list" onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
      {!q && <li className="np-search-note">Type a song or artist to add it.</li>}
      {searching && Array.from({ length: 3 }, (_, index) => <li className="np-search-loading" key={`search-skeleton-${index}`} aria-hidden="true">
        <Skeleton className="np-search-cover" />
        <span className="np-search-copy"><Skeleton /><Skeleton /></span>
      </li>)}
      {!searching && error && <li className="np-search-note">{error}</li>}
      {!searching && results.map((track) => {
        const queued = queuedIds.includes(track.id)
        return <li key={track.id}>
          <button className="np-queue-track" onClick={() => onPlay?.(track)}>
            <img src={track.thumbnail} alt="" loading="lazy" decoding="async" />
            <span><strong>{track.title}</strong><small>{track.artist}</small></span>
          </button>
          <button className="np-icon small" onClick={() => onPlayNext?.(track)} aria-label={`Play ${track.title} next`} title="Play next"><ListStart size={16} /></button>
          <button className="np-icon small" onClick={(event) => !queued && onQueue?.(track, event.currentTarget)} disabled={queued} aria-label={queued ? `${track.title} is in the queue` : `Add ${track.title} to queue`}>
            {queued ? <Check size={16} /> : <Plus size={17} />}
          </button>
        </li>
      })}
    </ul>
  </div>
}
