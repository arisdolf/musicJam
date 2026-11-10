import { useState, useCallback } from 'react'
import { AccountProvider } from './features/account/AccountContext'
import { createRoomCode, useRoom } from './features/rooms/useRoom'
import Topbar from './components/Topbar'
import Sidenav from './components/Sidenav'
import BottomNav from './components/BottomNav'
import AuthModal from './components/AuthModal'
import JoinRoom from './components/JoinRoom'
import MusicRoom from './components/MusicRoom'
import Playlists from './components/Playlists'
import Explore from './pages/Explore'
import RecentRooms from './pages/RecentRooms'
import Settings from './pages/Settings'
import { useAccount } from './features/account/AccountContext'
import './App.css'

// ── Inner shell (needs AccountContext) ────────────────────────────────────────
function Shell() {
  const { user } = useAccount()
  const [view, setView]           = useState('home')   // 'home'|'playlists'|'explore'|'recent'|'settings'
  const [roomCode, setRoomCode]   = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '')
  const [navOpen, setNavOpen]     = useState(false)

  const { room, updateRoom, connection, members } = useRoom(roomCode)

  const setUrlRoom = (code) => {
    const url = new URL(window.location.href)
    if (code) url.searchParams.set('room', code); else url.searchParams.delete('room')
    window.history.pushState({}, '', url)
    setRoomCode(code)
  }

  const joinRoom  = useCallback((code) => { setView('home'); setUrlRoom(code) }, [])
  const leaveRoom = useCallback(() => setUrlRoom(''), [])

  const navigate = useCallback((id) => {
    // Navigating away from a room leaves it
    if (id !== 'home' && roomCode) setUrlRoom('')
    setView(id)
  }, [roomCode])

  const playPlaylist = (playlist) => {
    const code = createRoomCode()
    try { localStorage.setItem(`jamroom:${code}`, JSON.stringify({ queue: playlist.tracks, current: 0, playing: false })) } catch { /* noop */ }
    joinRoom(code)
  }

  // Add a track directly from Explore into the active room
  const addToRoom = roomCode
    ? (track) => updateRoom(state => {
        if (state.queue.some(t => t.id === track.id)) return state
        return { ...state, queue: [...state.queue, track] }
      })
    : null

  const renderContent = () => {
    if (roomCode) {
      return <MusicRoom roomCode={roomCode} room={room} updateRoom={updateRoom} connection={connection} members={members} onLeave={leaveRoom} />
    }
    switch (view) {
      case 'playlists': return <Playlists onPlay={playPlaylist} onBrowse={() => navigate('explore')} />
      case 'explore':   return <Explore onAddToRoom={addToRoom} />
      case 'recent':    return <RecentRooms onJoin={joinRoom} />
      case 'settings':  return user ? <Settings /> : null
      default:          return <JoinRoom onJoin={joinRoom} />
    }
  }

  // Active nav view (room counts as 'home' in nav)
  const activeView = roomCode ? 'home' : view

  return (
    <div className="app-shell">
      <Sidenav view={activeView} onNavigate={navigate} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="app-content">
        <Topbar onMenuOpen={() => setNavOpen(true)} />
        <div className="app-body">
          {renderContent()}
        </div>
        <BottomNav view={activeView} onNavigate={navigate} />
      </div>

      <AuthModal />
    </div>
  )
}

export default function App() {
  return <AccountProvider><Shell /></AccountProvider>
}
