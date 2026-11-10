import { useEffect, useState } from 'react'
import { useAccount } from '../features/account/AccountContext'
import { X, Music2, LogIn, UserPlus } from 'lucide-react'

// Inline Google icon (no extra dependency needed)
function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.4 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.4 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.1l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.4 5.7l6.2 5.2C36.9 39.3 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/>
    </svg>
  )
}

export default function AuthModal() {
  const { authMode, openAuth, closeAuth, signUp, logIn, logInWithGoogle } = useAccount()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)

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
    setBusy(true); setError('')
    try {
      if (isSignup) await signUp({ name, email, password })
      else await logIn({ email, password })
      setPassword('')
    } catch (err) {
      // Surface Firebase's human-readable messages.
      setError(friendlyError(err))
    } finally { setBusy(false) }
  }

  const handleGoogle = async () => {
    setBusy(true); setError('')
    try { await logInWithGoogle() }
    catch (err) { setError(friendlyError(err)) }
    finally { setBusy(false) }
  }

  return (
    <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAuth() }}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="modal-close" onClick={closeAuth} aria-label="Close"><X size={19} /></button>
        <div className="auth-icon"><Music2 size={20} /></div>
        <h2 id="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted">{isSignup ? 'Save songs into playlists and listen to them any time.' : 'Log in to open your playlists.'}</p>

        {/* Google sign-in */}
        <button type="button" className="btn btn-google btn-block" onClick={handleGoogle} disabled={busy}>
          <GoogleIcon /> Continue with Google
        </button>
        <div className="divider"><span>or</span></div>

        {isSignup && <label className="field">Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
        </label>}
        <label className="field">Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus={!isSignup} />
        </label>
        <label className="field">Password (at least 6 characters)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} />
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
  )
}

function friendlyError(err) {
  const code = err?.code || ''
  if (code === 'auth/email-already-in-use')   return 'An account with this email already exists. Log in instead.'
  if (code === 'auth/user-not-found')          return 'No account found with this email.'
  if (code === 'auth/wrong-password')          return 'Email or password is incorrect.'
  if (code === 'auth/invalid-credential')      return 'Email or password is incorrect.'
  if (code === 'auth/weak-password')           return 'Use a password with at least 6 characters.'
  if (code === 'auth/invalid-email')           return 'Enter a valid email address.'
  if (code === 'auth/popup-closed-by-user')    return ''   // user cancelled — no error shown
  if (code === 'auth/too-many-requests')       return 'Too many attempts. Please wait a moment and try again.'
  return err?.message || 'Something went wrong. Try again.'
}
