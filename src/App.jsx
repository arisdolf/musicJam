import { useState } from 'react'
import Header from './components/Header'
import AuthModal from './components/AuthModal'
import JoinRoom from './components/JoinRoom'
import MusicRoom from './components/MusicRoom'
import Playlists from './components/Playlists'
import { AccountProvider } from './features/account/AccountContext'
import { createRoomCode, useRoom } from './features/rooms/useRoom'
import './App.css'

function Shell() {
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '')
  const [view, setView] = useState('home') // 'home' | 'playlists'
  const { room, updateRoom, connection, members } = useRoom(roomCode)

  const setUrlRoom = (code) => {
    const url = new URL(window.location.href)
    if (code) url.searchParams.set('room', code)
    else url.searchParams.delete('room')
    window.history.pushState({}, '', url)
    setRoomCode(code)
  }

  const joinRoom = (code) => { setView('home'); setUrlRoom(code) }
  const leaveRoom = () => setUrlRoom('')

  const goHome = () => { setView('home'); if (roomCode) setUrlRoom('') }
  const goPlaylists = () => { if (roomCode) setUrlRoom(''); setView('playlists') }

  // Start a new room with a playlist already in the queue.
  const playPlaylist = (playlist) => {
    const code = createRoomCode()
    try {
      localStorage.setItem(`jamroom:${code}`, JSON.stringify({ queue: playlist.tracks, current: 0, playing: false }))
    } catch { /* Storage can be disabled. */ }
    joinRoom(code)
  }

  return <>
    <Header onHome={goHome} onPlaylists={goPlaylists} />
    {roomCode
      ? <MusicRoom roomCode={roomCode} room={room} updateRoom={updateRoom} connection={connection} members={members} onLeave={leaveRoom} />
      : view === 'playlists'
        ? <Playlists onPlay={playPlaylist} />
        : <JoinRoom onJoin={joinRoom} />}
    <AuthModal />
  </>
}

export default function App() {
  return <AccountProvider><Shell /></AccountProvider>
}