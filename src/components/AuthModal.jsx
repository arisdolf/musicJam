import { useEffect, useState } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { X, Music2, LogIn, UserPlus } from 'lucide-react'

export default function AuthModal() {
  const { authMode, openAuth, closeAuth, signUp, logIn } = useAccount()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setError('') }, [authMode])

  useEffect(() => {
    if (!authMode) return undefined
    const onKey = (event) => { if (event.key === 'Escape') closeAuth() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [authMode, closeAuth])

  if (!authMode) return null
  const isSignup = authMode === 'signup'

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (isSignup) await signUp({ name, email, password })
      else await logIn({ email, password })
      setPassword('')
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally { setBusy(false) }
  }

  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAuth() }}>
    <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button type="button" className="modal-close" onClick={closeAuth} aria-label="Close"><X size={19} /></button>
      <div className="auth-icon"><Music2 size={20} /></div>
      <h2 id="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
      <p className="muted">{isSignup ? 'Save songs into playlists and listen to them any time.' : 'Log in to open your playlists.'}</p>

      {isSignup && <label className="field">Name
        <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus />
      </label>}
      <label className="field">Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus={!isSignup} />
      </label>
      <label className="field">Password (at least 8 characters)
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} />
      </label>

      {error && <div className="form-error" role="alert">{error}</div>}

      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? 'Please wait…' : <>{isSignup ? <UserPlus size={16} /> : <LogIn size={16} />}{isSignup ? ' Sign up' : ' Log in'}</>}
      </button>
      <p className="modal-switch muted">
        {isSignup ? 'Already have an account?' : 'New here?'}{' '}
        <button type="button" className="link" onClick={() => openAuth(isSignup ? 'login' : 'signup')}>
          {isSignup ? 'Log in' : 'Sign up'}
        </button>
      </p>
    </form>
  </div>
}
