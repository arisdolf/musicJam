import { useState, useCallback, useRef } from 'react'
import { AccountProvider } from './features/account/AccountContext'
import { PlaybackProvider, usePlayback } from './features/playback/PlaybackContext'
import { useRoom } from './features/rooms/useRoom'
import Topbar from './components/Topbar'
import Sidenav from './components/Sidenav'
import BottomNav from './components/BottomNav'
import AuthModal from './components/AuthModal'
import JoinRoom from './components/JoinRoom'
import MusicRoom from './components/MusicRoom'
import Playlists from './pages/Playlists'
import Explore from './pages/Explore'
import RecentRooms from './pages/RecentRooms'
import Settings from './pages/Settings'
import PersistentPlayer from './components/PersistentPlayer'
import QueueFly from './components/QueueFly'
import { useAccount } from './features/account/AccountContext'
import ErrorBoundary from './components/ErrorBoundary'

// ── Inner shell (needs AccountContext) ────────────────────────────────────────
function Shell() {
  const { user } = useAccount()
  const {
    state: localPlaybackState,
    updatePlayback: updateLocalPlayback,
    playTrack: playLocalTrack,
    addToQueue: addLocalTrack,
    playTracks: playLocalTracks,
    startVideo,
  } = usePlayback()
  const [view, setView]           = useState('home')   // 'home'|'playlists'|'explore'|'recent'|'settings'
  const [roomCode, setRoomCode]   = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '')
  const [navOpen, setNavOpen]     = useState(false)
  const [queueFly, setQueueFly]   = useState(null)
  const queueFlyCounter = useRef(0)

  const { room, updateRoom, connection, members } = useRoom(roomCode)
  const roomQueue = room.queue
  const roomCurrent = room.current
  const roomPlaying = room.playing

  const setUrlRoom = useCallback((code) => {
    const url = new URL(window.location.href)
    if (code) url.searchParams.set('room', code); else url.searchParams.delete('room')
    window.history.pushState({}, '', url)
    setRoomCode(code)
  }, [])

 const joinRoom = useCallback((code) => {
  setView('home')
  setUrlRoom(code)
}, [setUrlRoom])

const leaveRoom = useCallback(() => {
  if (!roomQueue.length) {
    setUrlRoom('')
    return
  }
  const queue = [...roomQueue]
  for (const track of localPlaybackState.queue) {
    if (!queue.some((item) => item.id === track.id)) queue.push(track)
  }
  const currentTrackId = roomQueue[roomCurrent]?.id
  updateLocalPlayback({
    queue,
    current: Math.max(0, queue.findIndex((item) => item.id === currentTrackId)),
    playing: roomPlaying,
  })
  setUrlRoom('')
}, [updateLocalPlayback, localPlaybackState.queue, roomQueue, roomCurrent, roomPlaying, setUrlRoom])

const navigate = useCallback((id) => {
  if (id !== view) setView(id)
}, [view])

  const roomPlaybackActive = Boolean(roomCode && roomQueue.length)
  const playbackState = roomPlaybackActive ? room : localPlaybackState
  const updateActivePlayback = useCallback((update) => {
    if (roomPlaybackActive) updateRoom(update)
    else updateLocalPlayback(update)
  }, [roomPlaybackActive, updateRoom, updateLocalPlayback])

  const animateQueueAdd = useCallback((track, trigger) => {
    if (!trigger?.getBoundingClientRect) return
    const source = trigger.getBoundingClientRect()
    const start = { x: source.left + source.width / 2, y: source.top + source.height / 2 }
    requestAnimationFrame(() => {
      const queueButton = document.querySelector('[data-player-queue-trigger]')
      const playerDock = document.querySelector('.persistent-player:not(.is-empty)')
      const target = queueButton?.getBoundingClientRect() || playerDock?.getBoundingClientRect()
      if (!target) return
      const key = ++queueFlyCounter.current
      setQueueFly({ key, track, start, end: { x: target.left + target.width / 2, y: target.top + target.height / 2 } })
    })
  }, [])

  const completeQueueFly = useCallback((key) => {
    setQueueFly((current) => current?.key === key ? null : current)
  }, [])

  const playTrack = useCallback((track) => {
    if (!track?.id) return
    if (!roomCode) {
      playLocalTrack(track)
      return
    }
    updateRoom((state) => {
      const existingIndex = state.queue.findIndex((item) => item.id === track.id)
      const queue = existingIndex >= 0 ? state.queue : [...state.queue, track]
      return { ...state, queue, current: existingIndex >= 0 ? existingIndex : queue.length - 1, playing: true }
    })
    startVideo(track.id)
  }, [roomCode, updateRoom, playLocalTrack, startVideo])

  const queueTracks = useCallback((tracks) => {
  const list = (Array.isArray(tracks) ? tracks : []).filter((track) => track?.id)
  if (!list.length) return
  if (!roomCode) { list.forEach((track) => addLocalTrack(track)); return }
  updateRoom((state) => {
    const queue = [...state.queue]
    for (const track of list) {
      if (!queue.some((item) => item.id === track.id)) queue.push(track)
    }
    return { ...state, queue, current: state.queue.length ? state.current : 0 }
  })
}, [roomCode, updateRoom, addLocalTrack])

  const queueTrack = useCallback((track, trigger) => {
    if (!track?.id) return
    animateQueueAdd(track, trigger)
    if (!roomCode) {
      addLocalTrack(track)
      return
    }
    updateRoom((state) => state.queue.some((item) => item.id === track.id)
      ? state
      : { ...state, queue: [...state.queue, track], current: state.queue.length ? state.current : 0 })
  }, [roomCode, updateRoom, addLocalTrack, animateQueueAdd])

  const playTracks = useCallback((tracks, index = 0) => {
    if (!roomCode) {
      playLocalTracks(tracks, index)
      return
    }
    const track = tracks[index]
    if (!track) return
    updateRoom((state) => {
      const queue = [...state.queue]
      for (const item of tracks) {
        if (!queue.some((existing) => existing.id === item.id)) queue.push(item)
      }
      return { ...state, queue, current: queue.findIndex((item) => item.id === track.id), playing: true }
    })
    startVideo(track.id)
  }, [roomCode, updateRoom, playLocalTracks, startVideo])

  const renderContent = () => {
    if (roomCode && view === 'home') {
      return <MusicRoom roomCode={roomCode} room={room} updateRoom={updateRoom} connection={connection} members={members} onLeave={leaveRoom} onPlayTrack={playTrack} onQueueTrack={queueTrack} onPlayTracks={playTracks} onQueueTracks={queueTracks} />
    }
    switch (view) {
      case 'playlists': return <Playlists onBrowse={() => navigate('explore')} onPlayTracks={playTracks} onQueueTrack={queueTrack} />
      case 'explore':   return <Explore onPlayTrack={playTrack} onQueueTrack={queueTrack} />
      case 'recent':    return <RecentRooms onJoin={joinRoom} />
      case 'settings':  return user ? <Settings /> : null
      default:          return <JoinRoom onJoin={joinRoom} />
    }
  }

  const activeView = view
  
  return (

    
   <div className={`app-shell${playbackState.queue.length ? ' has-player' : ''}`}>
      <Sidenav view={activeView} onNavigate={navigate} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="app-content">
        <Topbar onMenuOpen={() => setNavOpen(true)} />
        <ErrorBoundary label="The player">
   <PersistentPlayer
  playback={playbackState}
  onPlaybackChange={updateActivePlayback}
  onNavigate={navigate}
  onPlayTrack={playTrack}
  onQueueTrack={queueTrack}
/>
</ErrorBoundary>

       <QueueFly motion={queueFly} onComplete={completeQueueFly} />
<div className="app-body">
  <ErrorBoundary label="This page" resetKey={`${view}:${roomCode || 'local'}`}>
    <div className="route-stage" key={`${view}:${roomCode || 'local'}`}>
      {renderContent()}
    </div>
  </ErrorBoundary>
</div>
        <BottomNav view={activeView} onNavigate={navigate} />
      </div>

      <AuthModal />
    </div>
  )
}

export default function App() {
  return <AccountProvider><PlaybackProvider><Shell /></PlaybackProvider></AccountProvider>
}
