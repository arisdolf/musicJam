import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSyncedLyrics, parseSyncedLyrics } from '../services/lyrics'
import { usePlayback } from '../features/playback/PlaybackContext'
import { useAccount } from '../features/account/AccountContext'
import { rubberBandAtBounds } from '../utils/motion'
import AddToPlaylist from './AddToPlaylist'
import { searchYouTube } from '../services/youtube'
import {
  ArrowLeft, Check, ChevronDown, Disc3, ListMusic, Loader, LogIn, Menu, Mic2, Minus, Pause, Play, Plus,
  Search, Settings, SkipBack, SkipForward, Trash2,
} from 'lucide-react'

const YOUTUBE_READY_EVENT = 'onYouTubeIframeAPIReady'
const OFFSET_KEY = 'jamroom:lyric-offset:'
const LYRIC_TICK_MS = 100

// Room sync: how far (seconds) this device may drift from the room clock before we seek.
const DRIFT_PLAYING = 1.5
const DRIFT_PAUSED = 0.4
const DRIFT_CHECK_MS = 4000
const SEEK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

function readOffset(trackId) {
  try { return Number(localStorage.getItem(OFFSET_KEY + trackId)) || 0 } catch { return 0 }
}

// `sync` is { now() } while a room drives playback (null for local listening). It makes the player
// follow the room's shared position, so someone joining mid-song lands at the same part.
export default function PersistentPlayer({ playback, onPlaybackChange, onNavigate, onPlayTrack, onQueueTrack, sync }) {
  const { registerPlayer } = usePlayback()
  const { user, openAuth } = useAccount()
  const [playerReady, setPlayerReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState('player')        // 'player' | 'queue' | 'search'
  const [lyricsFull, setLyricsFull] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lyricsState, setLyricsState] = useState({ key: '', record: null, error: '' })
  const [active, setActive] = useState({ key: '', index: -1 })
  const [offsets, setOffsets] = useState({})
  const playerHostRef = useRef(null)
  const playerRef = useRef(null)
  const requestedVideoRef = useRef(null)
  const hasPlayedRef = useRef(false)
  const lyricLineRefs = useRef([])
  const lyricsListRef = useRef(null)
  const callbacksRef = useRef({ playback, onPlaybackChange, sync })

  const playbackQueue = playback.queue
  const playbackCurrent = playback.current
  const playbackPlaying = playback.playing
  const syncStamp = playback.syncedAt
  const currentTrack = playbackQueue[playbackCurrent] || null
  const currentTrackId = currentTrack?.id
  const currentTrackLyricsId = currentTrack?.lyricsId
  const currentTrackTitle = currentTrack?.title
  const currentTrackArtist = currentTrack?.artist
  const currentTrackDuration = currentTrack?.duration
  const currentTrackThumbnail = currentTrack?.thumbnail
  const art = currentTrackId ? (currentTrackThumbnail || `https://i.ytimg.com/vi/${currentTrackId}/mqdefault.jpg`) : ''
  const lyricsKey = currentTrack ? [currentTrackId, currentTrackLyricsId || '', currentTrackTitle || '', currentTrackArtist || ''].join('|') : ''
  const lyricsRecord = lyricsState.key === lyricsKey ? lyricsState.record : null
  const lyricsLoading = Boolean(currentTrack && lyricsState.key !== lyricsKey)
  const lyricsError = lyricsState.key === lyricsKey ? lyricsState.error : ''
  const lyricsRecordId = lyricsRecord ? String(lyricsRecord.id) : ''
  const fullOpen = expanded && Boolean(currentTrack)
  const lyricsOpen = fullOpen && view === 'player' && lyricsFull
  const lyricLines = useMemo(() => parseSyncedLyrics(lyricsRecord?.syncedLyrics), [lyricsRecord])
  const activeLyricIndex = lyricsRecordId && active.key === lyricsRecordId ? active.index : -1
  const lyricOffset = currentTrackId ? (offsets[currentTrackId] ?? readOffset(currentTrackId)) : 0
  const currentLyricText = activeLyricIndex >= 0 ? lyricLines[activeLyricIndex]?.text : ''

  const collapse = useCallback(() => { setExpanded(false); setMenuOpen(false); setView('player') }, [])

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

  const changePlaying = useCallback((playing) => {
    const track = playbackQueue[playbackCurrent]
    if (!track) return
    onPlaybackChange((state) => ({ ...state, playing }), { position: livePosition() })
    if (playing) requestVideo(track)
    else playerRef.current?.pauseVideo?.()
  }, [onPlaybackChange, playbackCurrent, playbackQueue, requestVideo, livePosition])

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

  const nudgeOffset = (delta) => {
    if (!currentTrackId) return
    const next = Math.round((lyricOffset + delta) * 10) / 10
    setOffsets((current) => ({ ...current, [currentTrackId]: next }))
    try {
      if (next) localStorage.setItem(OFFSET_KEY + currentTrackId, String(next))
      else localStorage.removeItem(OFFSET_KEY + currentTrackId)
    } catch { /* storage is optional */ }
  }

  const go = (id) => { onNavigate?.(id); collapse() }

  useEffect(() => { callbacksRef.current = { playback, onPlaybackChange, sync } }, [playback, onPlaybackChange, sync])

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
              // Every device sees the song end. Only advance if the room is still on the song that ended,
              // otherwise a joiner would skip an extra track.
              const endedId = event.target?.getVideoData?.()?.video_id
              const single = latest.playback.queue.length <= 1
              latest.onPlaybackChange((state) => {
                if (endedId && state.queue[state.current]?.id !== endedId) return state
                return state.queue.length > 1
                  ? { ...state, current: (state.current + 1) % state.queue.length, playing: true }
                  : { ...state, playing: false }
              }, single ? { position: 0 } : undefined)
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
    }
  }, [registerPlayer, livePosition])

  // Load / play / pause whatever the (local or room) state says. New songs start at the room's position.
  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || !player || !currentTrackId) return undefined

    try {
      if (player.getVideoData?.()?.video_id !== currentTrackId) {
        if (requestedVideoRef.current !== currentTrackId) {
          requestedVideoRef.current = currentTrackId
          hasPlayedRef.current = false
          const startSeconds = syncTarget(currentTrackId) ?? 0
          if (playbackPlaying) player.loadVideoById({ videoId: currentTrackId, startSeconds })
          else player.cueVideoById({ videoId: currentTrackId, startSeconds })
        }
      } else if (playbackPlaying) player.playVideo()
      else player.pauseVideo()
    } catch (error) {
      console.warn('YouTube player is not ready yet:', error)
    }

    if (!playbackPlaying) return undefined
    const timer = setTimeout(() => {
      const state = player.getPlayerState?.()
      if (state !== 1 && state !== 3) {
        try { player.playVideo?.() } catch { /* player went away */ }
      }
    }, 1200)
    return () => clearTimeout(timer)
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

  // ── Lyrics fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lyricsKey) return undefined
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
  }, [lyricsKey, currentTrackId, currentTrackLyricsId, currentTrackTitle, currentTrackArtist, currentTrackDuration])

  // ── Lyric sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || !player || !lyricLines.length || !lyricsRecordId) return undefined
    const tick = () => {
      const time = Number(player.getCurrentTime?.() || 0) - lyricOffset
      const index = findLyricIndex(lyricLines, time)
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
        artwork: currentTrackThumbnail ? [{ src: currentTrackThumbnail, sizes: '320x180', type: 'image/jpeg' }] : [],
      })
    }
    const actions = {
      play: () => changePlaying(true),
      pause: () => changePlaying(false),
      previoustrack: () => playIndex(playbackCurrent - 1),
      nexttrack: () => playIndex(playbackCurrent + 1),
    }
    for (const [action, handler] of Object.entries(actions)) {
      try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* unsupported action */ }
    }
    return () => {
      for (const action of Object.keys(actions)) {
        try { navigator.mediaSession.setActionHandler(action, null) } catch { /* noop */ }
      }
    }
  }, [currentTrackId, currentTrackTitle, currentTrackArtist, currentTrackThumbnail, playbackCurrent, changePlaying, playIndex])

  const offsetLabel = `${lyricOffset > 0 ? '+' : ''}${lyricOffset.toFixed(1)}s`
  const lineAt = (index) => (index >= 0 && index < lyricLines.length ? lyricLines[index].text || '♪' : '')
  const windowLines = activeLyricIndex >= 0
    ? [lineAt(activeLyricIndex - 1), lineAt(activeLyricIndex), lineAt(activeLyricIndex + 1)]
    : ['', '♪', lineAt(0)]
  const canPrev = playbackCurrent > 0
  const canNext = playbackCurrent < playbackQueue.length - 1

  return <>
    {/* The video lives here, off-screen. Only its audio is used. */}
    <div className="yt-host" ref={playerHostRef} aria-hidden="true" />

    {currentTrack && !fullOpen && <div className="mini-player" role="region" aria-label="Music player">
      <button className="mini-open" onClick={() => setExpanded(true)} aria-label={`Open player. Now playing ${currentTrack.title}`}>
        <img src={art} alt="" />
        <span className="mini-copy">
          <strong title={currentTrack.title}>{currentTrack.title}</strong>
          <small>{currentLyricText || currentTrack.artist}</small>
        </span>
      </button>
      <button className="icon-btn" onClick={() => playIndex(playbackCurrent - 1)} disabled={!canPrev} aria-label="Previous song"><SkipBack size={17} /></button>
      <button className="mini-play" onClick={togglePlay} aria-label={playbackPlaying ? 'Pause' : 'Play'}>
        <span key={playbackPlaying ? 'pause' : 'play'} className="motion-icon">{playbackPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</span>
      </button>
      <button className="icon-btn" onClick={() => playIndex(playbackCurrent + 1)} disabled={!canNext} aria-label="Next song"><SkipForward size={17} /></button>
    </div>}

    {fullOpen && <div className="np-overlay" role="dialog" aria-modal="true" aria-label="Now playing"
      onMouseDown={(event) => { if (event.target === event.currentTarget) collapse() }}>
      <section className="np-card">
        <div className="np-backdrop" style={{ backgroundImage: `url("${art}")` }} aria-hidden="true" />

        <header className="np-top">
          <button className="np-icon" onClick={view === 'player' ? collapse : () => setView('player')} aria-label={view === 'player' ? 'Close player' : 'Back to player'}>
            {view === 'player' ? <ChevronDown size={22} /> : <ArrowLeft size={20} />}
          </button>
          <span className="np-kicker">{view === 'queue' ? 'UP NEXT' : view === 'search' ? 'ADD MUSIC' : 'NOW PLAYING'}</span>
          <span className="np-top-spacer" />
        </header>

        {view === 'search'
          ? <SongSearch
              queuedIds={playbackQueue.map((track) => track.id)}
              onPlay={onPlayTrack}
              onQueue={onQueueTrack}
            />
          : view === 'queue'
            ? <ul className="np-queue-list" onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
                {playbackQueue.map((track, index) => <li className={index === playbackCurrent ? 'current' : ''} key={`${track.id}-${index}`}>
                  <button className="np-queue-track" onClick={() => playIndex(index)}>
                    <img src={track.thumbnail || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" />
                    <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                  </button>
                  <button className="np-icon small" onClick={() => removeTrack(index)} aria-label={`Remove ${track.title}`}><Trash2 size={15} /></button>
                </li>)}
              </ul>
            : <div className="np-body">
                <div className={`np-stage${lyricsFull ? ' is-lyrics' : ''}`}>
                  {lyricsFull
                    ? <>
                        <div className="np-lyrics-bar">
                          <span>Synced lyrics</span>
                          {lyricLines.length > 0 && <div className="lyric-offset" role="group" aria-label="Adjust lyric timing">
                            <button onClick={() => nudgeOffset(-0.5)} aria-label="Show lyrics earlier" title="Lyrics late? Show them earlier"><Minus size={13} /></button>
                            <span title="Lyric timing offset">{offsetLabel}</span>
                            <button onClick={() => nudgeOffset(0.5)} aria-label="Show lyrics later" title="Lyrics early? Show them later"><Plus size={13} /></button>
                          </div>}
                        </div>
                        {lyricsLoading && <p className="np-lyrics-note"><Loader size={15} className="spin" /> Loading lyrics…</p>}
                        {!lyricsLoading && lyricsError && <p className="np-lyrics-note">{lyricsError}</p>}
                        {!lyricsLoading && !lyricsError && <div className="np-lyrics-list" ref={lyricsListRef} onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
                          {lyricLines.map((line, index) => <p
                            key={`${line.time}-${index}`}
                            ref={(element) => { lyricLineRefs.current[index] = element }}
                            className={index === activeLyricIndex ? 'current' : ''}
                          >{line.text || '♪'}</p>)}
                        </div>}
                      </>
                    : <img key={currentTrackId} className="np-art" src={art} alt="" />}
                </div>

                <div className="np-title-row">
                  <div className="np-title">
                    <strong title={currentTrack.title}>{currentTrack.title}</strong>
                    <small>{currentTrack.artist}</small>
                  </div>
                  <AddToPlaylist track={currentTrack} />
                </div>

                {!lyricsFull && <div className="np-lyric-window" aria-live="off">
                  {lyricsLoading
                    ? <p className="current"><Loader size={15} className="spin" /> Loading lyrics…</p>
                    : lyricsError
                      ? <p>{lyricsError}</p>
                      : windowLines.map((text, slot) => <p key={`${activeLyricIndex}:${slot}`} className={slot === 1 ? 'current' : ''}>{text}</p>)}
                </div>}

                <ProgressBar key={currentTrackId} playerRef={playerRef} fallbackDuration={currentTrackDuration} onSeek={seekRoom} />
              </div>}

        <footer className="np-controls">
          <button className={`np-circle${lyricsFull && view === 'player' ? ' active' : ''}`} onClick={() => { setView('player'); setLyricsFull((open) => !open) }} aria-label="Toggle full lyrics" aria-pressed={lyricsFull}><Mic2 size={17} /></button>
          <button className="np-icon" onClick={() => playIndex(playbackCurrent - 1)} disabled={!canPrev} aria-label="Previous song"><SkipBack size={22} fill="currentColor" /></button>
          <button className="np-play" onClick={togglePlay} aria-label={playbackPlaying ? 'Pause' : 'Play'}>
            <span key={playbackPlaying ? 'pause' : 'play'} className="motion-icon">{playbackPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}</span>
          </button>
          <button className="np-icon" onClick={() => playIndex(playbackCurrent + 1)} disabled={!canNext} aria-label="Next song"><SkipForward size={22} fill="currentColor" /></button>
          <button className={`np-circle${menuOpen ? ' active' : ''}`} onClick={() => setMenuOpen((open) => !open)} aria-label="More options" aria-haspopup="menu" aria-expanded={menuOpen}><Menu size={17} /></button>
        </footer>

        {menuOpen && <>
          <div className="np-menu-scrim" onClick={() => setMenuOpen(false)} />
          <div className="np-menu" role="menu">
            <button role="menuitem" onClick={() => { setView('search'); setMenuOpen(false) }}><Search size={16} /> Add music</button>
            <button role="menuitem" onClick={() => { setView('queue'); setMenuOpen(false) }}><ListMusic size={16} /> Queue <small>{playbackQueue.length}</small></button>
            {user
              ? <>
                  <button role="menuitem" onClick={() => go('playlists')}><Disc3 size={16} /> My playlists</button>
                  <button role="menuitem" onClick={() => go('settings')}><Settings size={16} /> Settings</button>
                </>
              : <button role="menuitem" onClick={() => { collapse(); openAuth('login') }}><LogIn size={16} /> Log in to save music</button>}
          </div>
        </>}
      </section>
    </div>}
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

function SongSearch({ queuedIds, onPlay, onQueue }) {
  const [query, setQuery] = useState('')
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
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Search songs or artists"
      aria-label="Search songs or artists"
      autoFocus
    />
    <ul className="np-queue-list" onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
      {!q && <li className="np-search-note">Type a song or artist to add it.</li>}
      {searching && <li className="np-search-note"><Loader size={15} className="spin" /> Searching…</li>}
      {!searching && error && <li className="np-search-note">{error}</li>}
      {!searching && results.map((track) => {
        const queued = queuedIds.includes(track.id)
        return <li key={track.id}>
          <button className="np-queue-track" onClick={() => onPlay?.(track)}>
            <img src={track.thumbnail} alt="" />
            <span><strong>{track.title}</strong><small>{track.artist}</small></span>
          </button>
          <button className="np-icon small" onClick={(event) => !queued && onQueue?.(track, event.currentTarget)} disabled={queued} aria-label={queued ? `${track.title} is in the queue` : `Add ${track.title} to queue`}>
            {queued ? <Check size={16} /> : <Plus size={17} />}
          </button>
        </li>
      })}
    </ul>
  </div>
}
