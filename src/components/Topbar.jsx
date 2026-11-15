import { Music2 } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'

export default function Topbar() {
  const { user, openAuth } = useAccount()
  return (
    <header className={`topbar${user ? '' : ' topbar-guest'}`}>
      {user && <span aria-hidden="true" />}
      <div className="topbar-logo">
        <span className="logo-mark"><Music2 size={16} strokeWidth={2.4} /></span>
        <span>jamroom</span>
      </div>
      {user
        ? <span aria-hidden="true" />
        : <div className="topbar-auth">
            <button className="btn btn-text btn-small" onClick={() => openAuth('login')}>Log in</button>
            <button className="btn btn-primary btn-small" onClick={() => openAuth('signup')}>Sign up</button>
          </div>}
    </header>
  )
}