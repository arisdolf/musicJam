import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSyncedLyrics, parseSyncedLyrics } from '../services/lyrics'
import { usePlayback } from '../features/playback/PlaybackContext'
import { rubberBandAtBounds } from '../utils/motion'
import { ListMusic, Loader, Music2, Pause, Play, SkipBack, SkipForward, Trash2, X } from 'lucide-react'

const YOUTUBE_READY_EVENT = 'onYouTubeIframeAPIReady'

export default function PersistentPlayer({ playback, onPlaybackChange }) {
  const { registerPlayer } = usePlayback()
  const [playerReady, setPlayerReady] = useState(false)
  const [panel, setPanel] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [pendingPanel, setPendingPanel] = useState(null)
  const [panelOrigin, setPanelOrigin] = useState('90% 0%')
  const [lyricsState, setLyricsState] = useState({ key: '', record: null, error: '' })
  const [playbackTime, setPlaybackTime] = useState(0)
  const playerRef = useRef(null)
  const requestedVideoRef = useRef(null)
  const lyricLineRefs = useRef([])
  const callbacksRef = useRef({ playback, onPlaybackChange })

  const playbackQueue = playback.queue
  const playbackCurrent = playback.current
  const playbackPlaying = playback.playing
  const currentTrack = playbackQueue[playbackCurrent] || null
  const currentTrackId = currentTrack?.id
  const currentTrackLyricsId = currentTrack?.lyricsId
  const currentTrackTitle = currentTrack?.title
  const currentTrackArtist = currentTrack?.artist
  const currentTrackThumbnail = currentTrack?.thumbnail
  const lyricsKey = currentTrack ? [currentTrackId, currentTrackLyricsId || '', currentTrackTitle || '', currentTrackArtist || ''].join('|') : ''
  const lyricsRecord = lyricsState.key === lyricsKey ? lyricsState.record : null
  const lyricsLoading = Boolean(currentTrack && lyricsState.key !== lyricsKey)
  const lyricsError = lyricsState.key === lyricsKey ? lyricsState.error : ''
  const queueOpen = panel === 'queue' && panelOpen
  const lyricsOpen = panel === 'lyrics' && panelOpen
  const lyricLines = useMemo(() => parseSyncedLyrics(lyricsRecord?.syncedLyrics), [lyricsRecord])
  const activeLyricIndex = findLyricIndex(lyricLines, playbackTime)

  const requestVideo = useCallback((track, shouldPlay = true) => {
    const player = playerRef.current
    if (!track?.id || !player) return
    if (player.getVideoData?.().video_id === track.id) {
      if (shouldPlay) player.playVideo()
      else player.pauseVideo()
      return
    }
    requestedVideoRef.current = track.id
    if (shouldPlay) player.loadVideoById(track.id)
    else player.cueVideoById(track.id)
  }, [])

  const playIndex = useCallback((index) => {
    const track = playbackQueue[index]
    if (!track) return
    onPlaybackChange((state) => ({ ...state, current: index, playing: true }))
    requestVideo(track)
  }, [onPlaybackChange, playbackQueue, requestVideo])

  const changePlaying = useCallback((playing) => {
    const track = playbackQueue[playbackCurrent]
    if (!track) return
    onPlaybackChange((state) => ({ ...state, playing }))
    if (playing) requestVideo(track)
    else playerRef.current?.pauseVideo?.()
  }, [onPlaybackChange, playbackCurrent, playbackQueue, requestVideo])

  const removeTrack = useCallback((index) => onPlaybackChange((state) => {
    const queue = state.queue.filter((_, itemIndex) => itemIndex !== index)
    const current = queue.length ? Math.min(state.current > index ? state.current - 1 : state.current, queue.length - 1) : 0
    return { ...state, queue, current, playing: queue.length ? state.playing : false }
  }), [onPlaybackChange])

  const togglePanel = (nextPanel, trigger) => {
    if (panel === nextPanel && panelOpen) {
      setPendingPanel(null)
      setPanelOpen(false)
    } else if (panel && panelOpen) {
      if (trigger) setPanelOrigin(getPanelOrigin(trigger))
      setPendingPanel(nextPanel)
      setPanelOpen(false)
    } else {
      if (trigger) setPanelOrigin(getPanelOrigin(trigger))
      setPanel(nextPanel)
      setPanelOpen(true)
    }
  }

  const finishPanelExit = (event) => {
    if (event.animationName !== 'panel-exit') return
    if (pendingPanel) {
      setPanel(pendingPanel)
      setPendingPanel(null)
      setPanelOpen(true)
    } else setPanel(null)
  }

  useEffect(() => { callbacksRef.current = { playback, onPlaybackChange } }, [playback, onPlaybackChange])

  useEffect(() => {
    const createPlayer = () => {
      if (!window.YT?.Player || playerRef.current) return
      playerRef.current = new window.YT.Player('persistent-youtube-player', {
        playerVars: { origin: window.location.origin, playsinline: 1, rel: 0, controls: 0 },
        events: {
          onReady: () => {
            const player = playerRef.current
            registerPlayer(player ? {
              getVideoData: () => player.getVideoData?.(),
              getCurrentTime: () => player.getCurrentTime?.(),
              getPlayerState: () => player.getPlayerState?.(),
              playVideo: () => player.playVideo(),
              pauseVideo: () => player.pauseVideo(),
              loadVideoById: (videoId) => {
                requestedVideoRef.current = videoId
                player.loadVideoById(videoId)
              },
            } : null)
            setPlayerReady(true)
          },
          onStateChange: (event) => {
            if (event.data === 1 || event.data === 3) requestedVideoRef.current = null
            const latest = callbacksRef.current
            if (event.data === 1 && !latest.playback.playing) {
              latest.onPlaybackChange((state) => ({ ...state, playing: true }))
            }
            if (event.data === 2 && latest.playback.playing) {
              latest.onPlaybackChange((state) => ({ ...state, playing: false }))
            }
            if (event.data === 0) {
              latest.onPlaybackChange((state) => state.queue.length > 1
                ? { ...state, current: (state.current + 1) % state.queue.length, playing: true }
                : { ...state, playing: false })
            }
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
      registerPlayer(null)
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [registerPlayer])

  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || !player || !currentTrackId) return

    if (player.getVideoData?.().video_id !== currentTrackId) {
      if (requestedVideoRef.current === currentTrackId) return
      requestedVideoRef.current = currentTrackId
      if (playbackPlaying) player.loadVideoById(currentTrackId)
      else player.cueVideoById(currentTrackId)
      return
    }

    if (playbackPlaying) player.playVideo()
    else player.pauseVideo()
  }, [currentTrackId, playbackPlaying, playerReady])

  useEffect(() => {
    if (!lyricsKey) return undefined

    const controller = new AbortController()
    getSyncedLyrics({
      id: currentTrackId,
      lyricsId: currentTrackLyricsId,
      title: currentTrackTitle,
      artist: currentTrackArtist,
    }, controller.signal)
      .then((record) => {
        if (!controller.signal.aborted) {
          setLyricsState({ key: lyricsKey, record, error: record ? '' : 'No synced lyrics are available for this song.' })
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setLyricsState({ key: lyricsKey, record: null, error: error.message || 'Could not load synced lyrics.' })
        }
      })
    return () => controller.abort()
  }, [lyricsKey, currentTrackId, currentTrackLyricsId, currentTrackTitle, currentTrackArtist])

  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || !player || !playbackPlaying) return undefined
    const timer = setInterval(() => setPlaybackTime(Number(player.getCurrentTime?.() || 0)), 250)
    return () => clearInterval(timer)
  }, [playerReady, currentTrackId, playbackPlaying])

  useEffect(() => {
    const line = lyricLineRefs.current[activeLyricIndex]
    if (lyricsOpen && line) line.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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

  return <aside className={`persistent-player${currentTrack ? ' has-track' : ' is-empty'}`} style={{ viewTransitionName: 'persistent-player' }} aria-label="Music player">
    <div className="persistent-player-video"><div id="persistent-youtube-player" /></div>
    {currentTrack && <>
      <div className="persistent-player-info">
        <span className="persistent-player-icon"><Music2 size={17} /></span>
        <div className="persistent-player-copy">
          <span className="persistent-player-kicker">NOW PLAYING</span>
          <strong title={currentTrack.title}>{currentTrack.title}</strong>
          <small>{currentTrack.artist}</small>
          {lyricsOpen && activeLyricIndex >= 0 && <span className="persistent-current-lyric">{lyricLines[activeLyricIndex]?.text}</span>}
          <span key={playbackQueue.length} className="player-queue-count">{playbackQueue.length} IN QUEUE</span>
        </div>
      </div>
      <div className="persistent-player-controls">
        <button className="icon-btn" onClick={() => playIndex(playback.current - 1)} disabled={playback.current <= 0} aria-label="Previous song"><SkipBack size={17} /></button>
        <button className="persistent-play-btn" onClick={() => changePlaying(!playbackPlaying)} aria-label={playbackPlaying ? 'Pause' : 'Play'}><span key={playbackPlaying ? 'pause' : 'play'} className="motion-icon">{playbackPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</span></button>
        <button className="icon-btn" onClick={() => playIndex(playback.current + 1)} disabled={playback.current >= playback.queue.length - 1} aria-label="Next song"><SkipForward size={17} /></button>
        <button className={`icon-btn${lyricsOpen ? ' active' : ''}`} onClick={(event) => togglePanel('lyrics', event.currentTarget)} aria-label="Toggle lyrics" aria-expanded={lyricsOpen} title="Lyrics"><Music2 size={17} /></button>
        <button className={`icon-btn${queueOpen ? ' active' : ''}`} data-player-queue-trigger onClick={(event) => togglePanel('queue', event.currentTarget)} aria-label="Open queue" aria-expanded={queueOpen} title="Queue"><ListMusic size={17} /></button>
      </div>
      {panel === 'queue' && <div className={`persistent-panel persistent-queue-panel persistent-panel-${panelOpen ? 'enter' : 'exit'}`} style={{ transformOrigin: panelOrigin }} onAnimationEnd={finishPanelExit}>
        <div className="persistent-panel-heading"><strong>Up next</strong><span>{playback.queue.length} {playback.queue.length === 1 ? 'song' : 'songs'}</span><button className="icon-btn" onClick={() => togglePanel('queue')} aria-label="Close queue"><X size={17} /></button></div>
        {playbackQueue.length === 0 ? <p className="persistent-panel-empty">Your queue is empty.</p> : <ul className="persistent-queue-list" onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
          {playbackQueue.map((track, index) => <li className={index === playbackCurrent ? 'current' : ''} key={`${track.id}-${index}`}>
            <button className="persistent-queue-track" onClick={() => playIndex(index)}>
              <img src={track.thumbnail || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" />
              <span><strong>{track.title}</strong><small>{track.artist}</small></span>
            </button>
            <button className="icon-btn" onClick={() => removeTrack(index)} aria-label={`Remove ${track.title}`}><Trash2 size={15} /></button>
          </li>)}
        </ul>}
      </div>}
      {panel === 'lyrics' && <div className={`persistent-panel persistent-lyrics-panel persistent-panel-${panelOpen ? 'enter' : 'exit'}`} style={{ transformOrigin: panelOrigin }} onAnimationEnd={finishPanelExit}>
        <div className="persistent-panel-heading"><strong>Synced lyrics</strong><span>LRCLIB</span><button className="icon-btn" onClick={() => togglePanel('lyrics')} aria-label="Close lyrics"><X size={17} /></button></div>
        {lyricsLoading && <p className="persistent-panel-empty"><Loader size={15} className="spin" /> Loading lyricsâ€¦</p>}
        {!lyricsLoading && lyricsError && <p className="persistent-panel-empty">{lyricsError}</p>}
        {!lyricsLoading && !lyricsError && <div className="persistent-lyrics-list" onWheel={(event) => rubberBandAtBounds(event.currentTarget, event.deltaY)}>
          {lyricLines.map((line, index) => <p
            key={`${line.time}-${index}`}
            ref={(element) => { lyricLineRefs.current[index] = element }}
            className={index === activeLyricIndex ? 'current' : ''}
          >{line.text}</p>)}
        </div>}
      </div>}
    </>}
  </aside>
}

function findLyricIndex(lines, currentTime) {
  let low = 0
  let high = lines.length - 1
  let active = -1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (lines[middle].time <= currentTime) { active = middle; low = middle + 1 }
    else high = middle - 1
  }
  return active
}

function getPanelOrigin(trigger) {
  const rect = trigger.getBoundingClientRect()
  const mobile = window.innerWidth <= 480
  const width = mobile ? window.innerWidth - 16 : Math.min(420, window.innerWidth - 24)
  const height = Math.min(window.innerHeight * (mobile ? 0.65 : 0.65), 520)
  const left = mobile ? 8 : window.innerWidth - width - 12
  const top = mobile
    ? window.innerHeight - height - 76
    : (document.querySelector('.persistent-player')?.getBoundingClientRect().bottom || rect.bottom) + 8
  const x = Math.max(0, Math.min(width, rect.left + rect.width / 2 - left))
  const y = Math.max(0, Math.min(height, rect.top + rect.height / 2 - top))
  return `${x}px ${y}px`
}
