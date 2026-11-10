// src/components/Sidenav.jsx
import { useEffect } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { Music2, Home, ListMusic, Compass, History, Settings, LogIn, UserPlus, X, LogOut } from 'lucide-react'

const NAV = [
  { id: 'home',     label: 'Home',         icon: Home },
  { id: 'explore',  label: 'Explore',      icon: Compass },
  { id: 'playlists',label: 'Playlists',    icon: ListMusic, authOnly: true },
  { id: 'recent',   label: 'Recent Rooms', icon: History },
  { id: 'settings', label: 'Settings',     icon: Settings,  authOnly: true },
]

export default function Sidenav({ view, onNavigate, open, onClose }) {
  const { user, openAuth, logOut } = useAccount()

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  const go = (id) => { onNavigate(id); onClose() }

  const visibleNav = NAV.filter(n => !n.authOnly || user)

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && <div className="sidenav-backdrop" onClick={onClose} />}

      <nav className={`sidenav${open ? ' sidenav-open' : ''}`} aria-label="Main navigation">
        {/* Logo */}
        <div className="sidenav-logo">
          <span className="logo-mark"><Music2 size={16} strokeWidth={2.4} /></span>
          <span className="sidenav-logo-text">jamroom</span>
          <button className="sidenav-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        {/* Nav items */}
        <ul className="sidenav-nav">
          {visibleNav.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                className={`sidenav-item${view === id ? ' active' : ''}`}
                onClick={() => go(id)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="sidenav-footer">
          {user ? (
            <div className="sidenav-user">
              <div className="sidenav-avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="sidenav-user-info">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <button className="icon-btn sidenav-logout" onClick={() => { logOut(); onClose() }} title="Sign out">
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <div className="sidenav-auth-btns">
              <button className="btn btn-primary btn-block" onClick={() => { openAuth('signup'); onClose() }}>
                <UserPlus size={15} /> Sign up
              </button>
              <button className="btn btn-block" onClick={() => { openAuth('login'); onClose() }}>
                <LogIn size={15} /> Log in
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
