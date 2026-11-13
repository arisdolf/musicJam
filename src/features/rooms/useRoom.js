// src/features/rooms/useRoom.js
// Shared rooms through your own API (Postgres). Polls every 2 seconds.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../services/api'
import { saveRecentRoom } from '../../pages/RecentRooms'

const emptyRoom = { queue: [], current: 0, playing: false }
const MAX_QUEUE = 200
const POLL_MS = 2000

function clean(room) {
  const queue = JSON.parse(JSON.stringify((room?.queue ?? []).slice(0, MAX_QUEUE)))
  return {
    queue,
    current: Math.max(0, Math.min(Number(room?.current) || 0, queue.length - 1)),
    playing: Boolean(room?.playing),
  }
}

function savedRoom(roomCode) {
  try {
    const stored = JSON.parse(localStorage.getItem(`jamroom:${roomCode}`) || 'null')
    if (stored && Array.isArray(stored.queue)) return clean({ ...stored, playing: false })
  } catch { /* noop */ }
  return emptyRoom
}

function cacheRoom(roomCode, room) {
  try { localStorage.setItem(`jamroom:${roomCode}`, JSON.stringify(room)) } catch { /* noop */ }
}

// A fresh id per tab load, so duplicated tabs still count as two people.
const makeClientId = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2)

export function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function useRoom(roomCode) {
  const [room, setRoom]             = useState(() => roomCode ? savedRoom(roomCode) : emptyRoom)
  const [connection, setConnection] = useState('connecting')
  const [members, setMembers]       = useState(1)
  const [clientId]                  = useState(makeClientId)
  const roomRef    = useRef(room)
  const versionRef = useRef(-1)
  const writesRef  = useRef(0)

  useEffect(() => {
    if (!roomCode) return undefined
    let cancelled = false
    const initial = savedRoom(roomCode)
    roomRef.current = initial
    versionRef.current = -1
    setRoom(initial)
    setConnection('connecting')
    saveRecentRoom(roomCode)

    const poll = async () => {
      try {
        const data = await api(`/api/rooms/${roomCode}?client=${encodeURIComponent(clientId)}`)
        if (cancelled) return
        setConnection('connected')
        setMembers(data.members)
        if (writesRef.current > 0 || data.room.version === versionRef.current) return
        versionRef.current = data.room.version
        const next = clean(data.room)
        if (data.room.version === 0 || JSON.stringify(next) === JSON.stringify(roomRef.current)) return
        roomRef.current = next
        setRoom(next)
        cacheRoom(roomCode, next)
      } catch (error) {
        if (!cancelled) { console.error('Room poll failed:', error); setConnection('local') }
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [roomCode, clientId])

  const updateRoom = useCallback((update) => {
    if (!roomCode) return
    const next = clean(typeof update === 'function' ? update(roomRef.current) : update)
    roomRef.current = next
    setRoom(next)
    cacheRoom(roomCode, next)

    writesRef.current++
    api(`/api/rooms/${roomCode}`, { method: 'PUT', body: next })
      .then(({ version }) => { versionRef.current = version })
      .catch((error) => { console.error('Room write failed:', error); setConnection('local') })
      .finally(() => { writesRef.current-- })
  }, [roomCode])

  return { room, updateRoom, connection, members }
}