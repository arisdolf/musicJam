// src/components/BottomNav.jsx  — mobile-only bottom navigation bar

import { Home, ListMusic, History, Settings, Headphones } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'
import { useFriends } from '../features/friends/FriendsContext'

const NAV_GUEST = [
  { id: 'home',   label: 'Home',     icon: Home },
  { id: 'create', label: 'Jam Room', icon: Headphones  },
  { id: 'recent', label: 'Rooms',    icon: History },
]
const NAV_AUTH = [
  { id: 'home',      label: 'Home',      icon: Home },
  { id: 'create',    label: 'Jam Room',  icon: Headphones},
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'recent',    label: 'Rooms',     icon: History },
  { id: 'settings',  label: 'Settings',  icon: Settings },
]

export default function BottomNav({ view, onNavigate }) {
  
  const { user } = useAccount()
  const { pendingCount } = useFriends()
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
           {id === 'settings' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
        </button>
      ))}
    </nav>
  )
}
