import { useCallback, useEffect, useRef, useState } from 'react'

const emptyRoom = { queue: [], current: 0, playing: false }

function savedRoom(roomCode) {
  try { return JSON.parse(localStorage.getItem(`jamroom:${roomCode}`) || 'null') || emptyRoom }
  catch { return emptyRoom }
}

export function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function useRoom(roomCode) {
  const [room, setRoom] = useState(() => roomCode ? savedRoom(roomCode) : emptyRoom)
  const [connection, setConnection] = useState('connecting')
  const [members, setMembers] = useState(1)
  const socketRef = useRef(null)
  const roomRef = useRef(room)
  useEffect(() => { roomRef.current = room }, [room])

  useEffect(() => {
    if (!roomCode) return undefined
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socketUrl = import.meta.env.VITE_ROOM_SERVER_URL || `${protocol}//${window.location.host}/ws`
    const socket = new WebSocket(socketUrl)
    socketRef.current = socket
    const storageKey = `jamroom:${roomCode}`
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(storageKey)

    const onMessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'room') {
        setRoom(data.room)
        setConnection('connected')
      }
      if (data.type === 'members') { setMembers(data.count); setConnection('connected') }
    }
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', roomCode, room: roomRef.current })))
    socket.addEventListener('message', onMessage)
    socket.addEventListener('error', () => setConnection('local'))
    socket.addEventListener('close', () => setConnection('local'))

    if (channel) {
      channel.addEventListener('message', (event) => setRoom(event.data))
    }

    return () => {
      socket.close()
      channel?.close()
      socketRef.current = null
    }
  }, [roomCode])

  const updateRoom = useCallback((update) => {
    const next = typeof update === 'function' ? update(roomRef.current) : update
    roomRef.current = next
    setRoom(next)
    try { localStorage.setItem(`jamroom:${roomCode}`, JSON.stringify(next)) } catch { /* Storage can be disabled. */ }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'update', roomCode, room: next }))
    } else if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(`jamroom:${roomCode}`)
      channel.postMessage(next)
      channel.close()
    }
  }, [roomCode])

  return { room, updateRoom, connection, members }
}
