import { useState } from 'react'
import JoinRoom from './components/JoinRoom'
import MusicRoom from './components/MusicRoom'
import { useRoom } from './features/rooms/useRoom'
import './App.css'

function App() {
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '')
  const { room, updateRoom, connection, members } = useRoom(roomCode)

  const joinRoom = (code) => {
    const url = new URL(window.location.href)
    url.searchParams.set('room', code)
    window.history.pushState({}, '', url)
    setRoomCode(code)
  }

  const leaveRoom = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    window.history.pushState({}, '', url)
    setRoomCode('')
  }

  return roomCode
    ? <MusicRoom roomCode={roomCode} room={room} updateRoom={updateRoom} connection={connection} members={members} onLeave={leaveRoom}/>
    : <JoinRoom onJoin={joinRoom}/>
}

export default App
