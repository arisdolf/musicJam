import { useAccount } from '../features/account/AccountContext'
import { useFriends } from '../features/friends/FriendsContext'
import { Music2, Home, ListMusic, History, Settings,  Headset, Headphones} from 'lucide-react'

const NAV = [
  { id: 'home',      label: 'Home',         icon: Home },
  { id: 'create',    label: 'Jam Room',     icon: Headphones  },
  { id: 'playlists', label: 'Playlists',    icon: ListMusic, authOnly: true },
  { id: 'recent',    label: 'Recent Rooms', icon: History },
  { id: 'settings',  label: 'Settings',     icon: Settings,  authOnly: true },
]

export default function Sidenav({ view, onNavigate }) {
  const { user } = useAccount()
  const { pendingCount } = useFriends()
  const visibleNav = NAV.filter((n) => !n.authOnly || user)

  return (
    <nav className="sidenav" aria-label="Main navigation">
      <div className="sidenav-logo">
        <span className="logo-mark"><Music2 size={16} strokeWidth={2.4} /></span>
        <span className="sidenav-logo-text">melojam</span>
      </div>

      <ul className="sidenav-nav">
        {visibleNav.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button className={`sidenav-item${view === id ? ' active' : ''}`} onClick={() => onNavigate(id)}>
              <Icon size={19} />
              <span>{label}</span>
              {id === 'settings' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
            </button>
          </li>
        ))}
      </ul>

      {user && (
        <div className="sidenav-footer">
          <div className="sidenav-user">
            <div className="sidenav-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="sidenav-user-info"><strong>{user.name}</strong><small>{user.email}</small></div>
          </div>
        </div>
      )}
    </nav>
  )
}