import { useEffect, useRef, useState } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { Music2, ListMusic, LogOut, LogIn, UserPlus } from 'lucide-react'

export default function Header({ onHome, onPlaylists }) {
  const { user, openAuth, logOut } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return <header className="topbar">
    <button className="logo" onClick={onHome} aria-label="Jamroom home"><span className="logo-mark"><Music2 size={17} strokeWidth={2.2} /></span>jamroom</button>

    {user
      ? <div className="account" ref={menuRef}>
          <button className="avatar" onClick={() => setMenuOpen((open) => !open)} aria-label="Account menu" aria-expanded={menuOpen}>
            {user.name.trim().charAt(0).toUpperCase()}
          </button>
          {menuOpen && <div className="menu" role="menu">
            <div className="menu-user"><strong>{user.name}</strong><small>{user.email}</small></div>
            <button role="menuitem" onClick={() => { setMenuOpen(false); onPlaylists() }}><ListMusic size={16} /> My playlists</button>
            <button role="menuitem" onClick={() => { setMenuOpen(false); logOut() }}><LogOut size={16} /> Log out</button>
          </div>}
        </div>
      : <div className="auth-actions">
          <button className="btn btn-text" onClick={() => openAuth('login')}><LogIn size={16} /> Log in</button>
          <button className="btn btn-primary" onClick={() => openAuth('signup')}><UserPlus size={16} /> Sign up</button>
        </div>}
  </header>
}
