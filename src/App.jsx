import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect, lazy, Suspense } from 'react'
import { FriendsProvider } from './features/friends/FriendsContext'
import { getSimilarTracks } from './services/youtube'
import InviteToasts from './components/InviteToasts'
import { AccountProvider } from './features/account/AccountContext'
import { PlaybackProvider, usePlayback } from './features/playback/PlaybackContext'
import { useRoom } from './features/rooms/useRoom'
import Topbar from './components/Topbar'
import Sidenav from './components/Sidenav'
import Home from './pages/Home'
import BottomNav from './components/BottomNav'
import { PageSkeleton } from './components/Skeleton'
import AuthModal from './components/AuthModal'
import { playNow, replaceQueue, playNext } from './utils/queue'
import { TopbarProvider } from './components/TopBarContext'
import PersistentPlayer from './components/PersistentPlayer'
import QueueFly from './components/QueueFly'
import { useAccount } from './features/account/AccountContext'
import ErrorBoundary from './components/ErrorBoundary'
import { recordPlay } from './utils/taste'
function lazyRoute(importer) {
  return lazy(async () => {
    let lastError
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await importer() }
      catch (error) {
        lastError = error
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
      }
    }
    throw lastError
  })
}

const JoinRoom = lazyRoute(() => import('./components/JoinRoom'))
const MusicRoom = lazyRoute(() => import('./components/MusicRoom'))
const Playlists = lazyRoute(() => import('./pages/Playlists'))
const RecentRooms = lazyRoute(() => import('./pages/RecentRooms'))
const Settings = lazyRoute(() => import('./pages/Settings'))

// ── Inner shell (needs AccountContext) ────────────────────────────────────────
function Shell() {
  const { user, loadingAccount } = useAccount()
  const {
    state: localPlaybackState,
    updatePlayback: updateLocalPlayback,
    playTrack: playLocalTrack,
    addToQueue: addLocalTrack,
    playTracks: playLocalTracks,
    
    startVideo,
  } = usePlayback()
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('room') ? 'create' : 'home')
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '')
  const [settingsSection, setSettingsSection] = useState(null) // null | 'friends' | 'quota'
  const [queueFly, setQueueFly] = useState(null)
  const queueFlyCounter = useRef(0)
  const similarRequest = useRef(0) // invalidates an older "similar songs" fetch if you play something else
  const openFriends = useCallback(() => { setSettingsSection('friends'); setView('settings') }, [])
  const { room, updateRoom, connection, members, serverNow } = useRoom(roomCode)
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
  setView('create')
  setUrlRoom(code)
}, [setUrlRoom])


  // Clicking a system notification: join the invited room, or open Friends.
  useEffect(() => {
    const open = (detail) => {
      if (detail?.roomCode) joinRoom(detail.roomCode)
      else openFriends()
    }
    const onWindow = (event) => open(event.detail)
    const onWorker = (event) => { if (event.data?.type === 'jamroom:notification') open(event.data.data) }
    window.addEventListener('jamroom:notification', onWindow)
    navigator.serviceWorker?.addEventListener('message', onWorker)
    return () => {
      window.removeEventListener('jamroom:notification', onWindow)
      navigator.serviceWorker?.removeEventListener('message', onWorker)
    }
  }, [joinRoom, openFriends])


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
    if (id === 'settings') setSettingsSection(null)
    if (id !== view) setView(id)
  }, [view])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [view, settingsSection, roomCode])

  useEffect(() => {
    if (loadingAccount || user || !['playlists', 'settings'].includes(view)) return
    setSettingsSection(null)
    setView('home')
  }, [loadingAccount, user, view])

  const roomPlaybackActive = Boolean(roomCode && roomQueue.length)
  const playbackState = roomPlaybackActive ? room : localPlaybackState

    // A song counts toward "For you" after 15 seconds of playing, so skipped songs don't.
  const currentTrack = playbackState.queue[playbackState.current] || null
  const currentTrackId = currentTrack?.id
  const isPlaying = playbackState.playing
  const trackRef = useRef(null)
  useEffect(() => { trackRef.current = currentTrack })
  useEffect(() => {
    if (!currentTrackId || !isPlaying) return undefined
    const timer = setTimeout(() => recordPlay(trackRef.current), 15000)
    return () => clearTimeout(timer)
  }, [currentTrackId, isPlaying])
  
  // The player only follows the room's clock while a room is driving playback.
  const sync = useMemo(() => roomPlaybackActive ? { now: serverNow } : null, [roomPlaybackActive, serverNow])

  // options.position = the real playhead (seconds) for pause / resume / seek; ignored for local playback.
  const updateActivePlayback = useCallback((update, options) => {
    if (roomPlaybackActive) updateRoom(update, options)
    else updateLocalPlayback(update)
  }, [roomPlaybackActive, updateRoom, updateLocalPlayback])

  const animateQueueAdd = useCallback((track, trigger) => {
    if (!trigger?.getBoundingClientRect) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
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
     similarRequest.current++
    if (!track?.id) return
    if (!roomCode) { playLocalTrack(track); return }
    updateRoom((state) => playNow(state, [track]))
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

  const playNextTrack = useCallback((track) => {
    if (!track?.id) return
    if (!roomCode) { updateLocalPlayback((state) => playNext(state, track)); return }
    updateRoom((state) => playNext(state, track))
  }, [roomCode, updateRoom, updateLocalPlayback])

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
    similarRequest.current++
    if (!roomCode) { playLocalTracks(tracks, index); return }
    if (!tracks[index]?.id) return
    updateRoom((state) => replaceQueue(state, tracks, index))
    startVideo(tracks[index].id)
  }, [roomCode, updateRoom, playLocalTracks, startVideo])


// Plays this song on its own (the old queue/playlist is replaced), then adds up to 25 similar songs after it.
const playWithSimilar = useCallback(async (track) => {
  if (!track?.id) return
  playTracks([track], 0)
  const request = ++similarRequest.current
  try {
    const similar = await getSimilarTracks(track)
    if (request !== similarRequest.current) return // you already played something else
    queueTracks(similar.slice(0, 25))
  } catch { /* the song is already playing; recommendations are a bonus */ }
}, [playTracks, queueTracks])

const homePage = <Home user={user} currentTrack={currentTrack} isPlaying={isPlaying} onOpenJamRoom={() => navigate('create')} onQueueTrack={queueTrack} onPlayTracks={playTracks} />

const renderContent = () => {
  if (roomCode && view === 'create') {
    return <MusicRoom roomCode={roomCode} room={room} updateRoom={updateRoom} connection={connection} members={members} onLeave={leaveRoom} onPlayTrack={playTrack} onQueueTrack={queueTrack} onPlayTracks={playTracks} onQueueTracks={queueTracks} onPlayNext={playNextTrack} />
  }

  switch (view) {
    case 'create': return <JoinRoom onJoin={joinRoom} />
    case 'playlists': return user ? <Playlists onBrowse={() => navigate('home')} onPlayTracks={playTracks} onQueueTrack={queueTrack} /> : homePage
    case 'recent': return <RecentRooms onJoin={joinRoom} />
    case 'settings': return user ? <Settings roomCode={roomCode} section={settingsSection} onSectionChange={setSettingsSection} /> : homePage
    default: return homePage
  }
}

  if (loadingAccount) {
    return <div className="app-shell"><main className="app-content"><PageSkeleton view={view} roomCode={roomCode} settingsSection={settingsSection} /></main></div>
  }

  return (
    <div className={`app-shell${playbackState.queue.length ? ' has-player' : ''}`}>
      <Sidenav view={view} onNavigate={navigate} />

      <div className="app-content">
        <Topbar onPlaySong={playWithSimilar} onQueueTrack={queueTrack} />
        
        <ErrorBoundary label="The player">
          <PersistentPlayer
            playback={playbackState}

            onPlaybackChange={updateActivePlayback}
            onNavigate={navigate}
            onPlayTrack={playTrack}
            onQueueTrack={queueTrack}
            sync={sync}
            onPlayNext={playNextTrack} />
        </ErrorBoundary>

        <QueueFly motion={queueFly} onComplete={completeQueueFly} />
        <div className="app-body">
          <ErrorBoundary label="This page" resetKey={`${view}:${roomCode || 'local'}`}>
            <div className="route-stage" key={`${view}:${roomCode || 'local'}`}>
              <Suspense fallback={<PageSkeleton view={view} roomCode={roomCode} settingsSection={settingsSection} />}>
                {renderContent()}
              </Suspense>
            </div>
          </ErrorBoundary>
        </div>
        <BottomNav view={view} onNavigate={navigate} />
      </div>

      <InviteToasts onJoin={joinRoom} onOpenFriends={openFriends} />
      <AuthModal />
    </div>
  )
}

export default function App() {
  return <AccountProvider><FriendsProvider><PlaybackProvider><TopbarProvider><Shell /></TopbarProvider></PlaybackProvider></FriendsProvider></AccountProvider>
}
