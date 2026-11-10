// src/features/rooms/useRoom.js
// Real-time collaborative rooms via Firestore (replaces WebSocket).
import { useCallback, useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'

const emptyRoom = { queue: [], current: 0, playing: false }

function savedRoom(roomCode) {
  try { return JSON.parse(localStorage.getItem(`jamroom:${roomCode}`) || 'null') || emptyRoom }
  catch { return emptyRoom }
}

export function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function useRoom(roomCode) {
  const [room, setRoom]           = useState(() => roomCode ? savedRoom(roomCode) : emptyRoom)
  const [connection, setConnection] = useState('connecting')
  const [members, setMembers]     = useState(1)
  const roomRef                   = useRef(room)
  const isMineRef                 = useRef(false)   // flag to skip echo-back of our own writes

  useEffect(() => { roomRef.current = room }, [room])

  useEffect(() => {
    if (!roomCode) return undefined

    const initial = savedRoom(roomCode)
    roomRef.current = initial
    setRoom(initial)
    setConnection('connecting')

    const docRef = doc(db, 'rooms', roomCode)

    // Seed the room document if it doesn't exist yet.
    setDoc(docRef, {
      queue:     initial.queue.slice(0, 200),
      current:   Math.max(0, Math.min(Number(initial.current) || 0, initial.queue.length - 1)),
      playing:   Boolean(initial.playing),
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch(console.error)

    // Real-time listener — acts as the WebSocket "room" message.
    const unsub = onSnapshot(docRef, (snap) => {
      setConnection('connected')
      if (!snap.exists()) return
      if (isMineRef.current) { isMineRef.current = false; return } // skip our own writes
      const data = snap.data()
      const next = { queue: data.queue ?? [], current: data.current ?? 0, playing: data.playing ?? false }
      roomRef.current = next
      setRoom(next)
      try { localStorage.setItem(`jamroom:${roomCode}`, JSON.stringify(next)) } catch { /* noop */ }
    }, () => setConnection('local'))

    return () => unsub()
  }, [roomCode])

  const updateRoom = useCallback((update) => {
    const next = typeof update === 'function' ? update(roomRef.current) : update
    roomRef.current = next
    setRoom(next)
    try { localStorage.setItem(`jamroom:${roomCode}`, JSON.stringify(next)) } catch { /* noop */ }

    // Write to Firestore — all listeners in this room will receive it.
    const docRef = doc(db, 'rooms', roomCode)
    isMineRef.current = true
    setDoc(docRef, {
      queue:     next.queue.slice(0, 200),
      current:   Math.max(0, Math.min(next.current, next.queue.length - 1)),
      playing:   Boolean(next.playing),
      updatedAt: serverTimestamp(),
    }).catch(console.error)
  }, [roomCode])

  return { room, updateRoom, connection, members }
}
