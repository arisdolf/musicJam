// src/pages/RecentRooms.jsx
// Shows rooms the user has visited, stored in localStorage.
import { useMemo } from 'react'
import { History, ArrowRight, Trash2 } from 'lucide-react'

const STORAGE_KEY = 'jamroom:recent'
const MAX = 10

export function saveRecentRoom(code) {
  try {
    const list = getRecentRooms().filter(r => r.code !== code)
    list.unshift({ code, visitedAt: Date.now() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX)))
  } catch { /* storage disabled */ }
}

export function getRecentRooms() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function clearRecent() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

export default function RecentRooms({ onJoin }) {
  const rooms = useMemo(() => getRecentRooms(), [])

  if (rooms.length === 0) {
    return (
      <main className="page narrow">
        <div className="explore-header">
          <History size={22} />
          <div><h1>Recent Rooms</h1><p className="muted">Rooms you've visited will appear here.</p></div>
        </div>
        <p className="empty">No recent rooms yet. Create or join a room from the home page.</p>
      </main>
    )
  }

  const fmt = (ts) => {
    const diff = Date.now() - ts
    if (diff < 60000)   return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(ts).toLocaleDateString()
  }

  return (
    <main className="page narrow">
      <div className="explore-header">
        <History size={22} />
        <div><h1>Recent Rooms</h1><p className="muted">Jump back into a room you visited.</p></div>
      </div>

      <ul className="recent-list">
        {rooms.map(r => (
          <li key={r.code} className="recent-item">
            <div className="recent-info">
              <strong className="recent-code">{r.code}</strong>
              <small className="muted">{fmt(r.visitedAt)}</small>
            </div>
            <button className="btn btn-small" onClick={() => onJoin(r.code)}>
              <ArrowRight size={14} /> Join
            </button>
          </li>
        ))}
      </ul>

      <button className="btn btn-text btn-small danger-text" onClick={() => { clearRecent(); window.location.reload() }}>
        <Trash2 size={14} /> Clear history
      </button>
    </main>
  )
}
