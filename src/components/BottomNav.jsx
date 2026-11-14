// src/components/BottomNav.jsx  — mobile-only bottom navigation bar
import { Home, ListMusic, Gauge, History, Settings } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'

const NAV_GUEST = [
  { id: 'home',    label: 'Home',    icon: Home },
  { id: 'quota',     label: 'Quota',     icon: Gauge },
  { id: 'recent',  label: 'Rooms',   icon: History },
]
const NAV_AUTH = [
  { id: 'home',      label: 'Home',      icon: Home },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'quota',     label: 'Quota',     icon: Gauge },
  { id: 'recent',    label: 'Rooms',     icon: History },
  { id: 'settings',  label: 'Settings',  icon: Settings },
]

export default function BottomNav({ view, onNavigate }) {
  const { user } = useAccount()
  const items = user ? NAV_AUTH : NAV_GUEST

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`bottom-nav-item${view === id ? ' active' : ''}`}
          onClick={() => onNavigate(id)}
        >
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
