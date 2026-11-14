import { useCallback, useEffect, useRef, useState } from 'react'
import { ref, onValue, set, remove, onDisconnect } from 'firebase/database'
import { db } from '../../services/firebase'
import { saveRecentRoom } from '../../pages/RecentRooms'

// position = seconds into the current song at the moment `syncedAt` (server clock, ms).
// Anyone can work out "where the song is now" as: position + (serverNow - syncedAt) while playing.
const emptyRoom = { queue: [], current: 0, playing: false, position: 0, syncedAt: 0 }
const MAX_QUEUE = 200
const CLIENT_KEY = 'jamroom:client-id'

function clean(room) {
  const raw = room?.queue ?? []
  const list = Array.isArray(raw) ? raw : Object.values(raw) // RTDB may hand back an object
  const queue = JSON.parse(JSON.stringify(list.filter(Boolean).slice(0, MAX_QUEUE))) // strips undefined
  return {
    queue,
    current: Math.max(0, Math.min(Number(room?.current) || 0, queue.length - 1)),
    playing: Boolean(room?.playing),
    position: Math.max(0, Number(room?.position) || 0),
    syncedAt: Number(room?.syncedAt) || 0,
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

const makeClientId = () => {
  try {
    const saved = sessionStorage.getItem(CLIENT_KEY)
    if (saved) return saved
    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2)
    sessionStorage.setItem(CLIENT_KEY, id)
    return id
  } catch {
    return crypto.randomUUID?.() || Math.random().toString(36).slice(2)
  }
}

export function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function useRoom(roomCode) {
  const [room, setRoom]             = useState(() => roomCode ? savedRoom(roomCode) : emptyRoom)
  const [connection, setConnection] = useState('connecting')
  const [members, setMembers]       = useState(1)
  const [clientId]                  = useState(makeClientId)
  const roomRef = useRef(room)
  const offsetRef = useRef(0) // server clock minus this device's clock, in ms

  // Every device stamps positions with the Firebase server clock, so phones with a wrong clock still agree.
  const serverNow = useCallback(() => Date.now() + offsetRef.current, [])
  useEffect(() => onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    offsetRef.current = Number(snap.val()) || 0
  }), [])

  useEffect(() => {
    if (!roomCode) return undefined
    const initial = savedRoom(roomCode)
    roomRef.current = initial
    setRoom(initial)
    setConnection('connecting')
    saveRecentRoom(roomCode)

    const me = ref(db, `roomMembers/${roomCode}/${clientId}`)

    const offConn = onValue(ref(db, '.info/connected'), (snap) => {
      if (snap.val() === true) {
        setConnection('connected')
        onDisconnect(me).remove()
        set(me, true)
      } else setConnection('local')
    })

    // Fires on every remote change AND on our own writes (instantly, before the server confirms).
    const offRoom = onValue(ref(db, `rooms/${roomCode}`), (snap) => {
      if (!snap.exists()) return
      const next = clean(snap.val())
      if (JSON.stringify(next) === JSON.stringify(roomRef.current)) return
      roomRef.current = next
      setRoom(next)
      cacheRoom(roomCode, next)
    }, (error) => { console.error('Room listen failed:', error); setConnection('local') })

    const offMembers = onValue(ref(db, `roomMembers/${roomCode}`), (snap) => {
      setMembers(Math.max(1, snap.size))
    })

    return () => {
      offConn(); offRoom(); offMembers()
      remove(me).catch(() => {})
    }
  }, [roomCode, clientId])

  // update: new room state, or (state) => new state.
  // options.position: where the song really is right now (pause, resume, seek). When omitted:
  //   - a different song became current  -> 0
  //   - same song                         -> the position is carried forward by the elapsed time.
  const updateRoom = useCallback((update, options = {}) => {
    if (!roomCode) return
    const prev = roomRef.current
    const result = typeof update === 'function' ? update(prev) : update
    const hasPosition = Number.isFinite(options.position)
    if (result === prev && !hasPosition) return // nothing changed, nothing to broadcast

    const draft = clean(result)
    const now = serverNow()
    const prevId = prev.queue[prev.current]?.id
    const nextId = draft.queue[draft.current]?.id

    let position
    if (!nextId) position = 0
    else if (hasPosition) position = options.position
    else if (nextId !== prevId) position = 0
    else if (prev.playing && prev.syncedAt) position = prev.position + Math.max(0, now - prev.syncedAt) / 1000
    else position = prev.position

    const next = { ...draft, position: Math.round(Math.max(0, position) * 100) / 100, syncedAt: now }
    roomRef.current = next
    setRoom(next)
    cacheRoom(roomCode, next)
    set(ref(db, `rooms/${roomCode}`), { ...next, updatedAt: now })
      .catch((error) => { console.error('Room write failed:', error); setConnection('local') })
  }, [roomCode, serverNow])

  return { room, updateRoom, connection, members, serverNow }
}
