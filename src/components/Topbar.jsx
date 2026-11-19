import { ArrowLeft } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'
import { useTopbarValue } from './TopBarContext'

export default function Topbar({ fallbackTitle }) {
  const { user, openAuth } = useAccount()
  const { title, onBack } = useTopbarValue()
  return (
    <header className={`topbar${user ? '' : ' topbar-guest'}`}>
      <div className="topbar-side">
        {onBack && <button className="icon-btn topbar-back" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>}
      </div>
      <div className="topbar-title">{title || fallbackTitle}</div>
      <div className="topbar-side topbar-side-end">
        {!user && <div className="topbar-auth">
          <button className="btn btn-text btn-small" onClick={() => openAuth('login')}>Log in</button>
          <button className="btn btn-primary btn-small" onClick={() => openAuth('signup')}>Sign up</button>
        </div>}
      </div>
    </header>
  )
}