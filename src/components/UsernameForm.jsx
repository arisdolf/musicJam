import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useFriends, USERNAME_RE } from '../features/friends/FriendsContext'

export default function UsernameForm() {
  const { profile, setUsername } = useFriends()
  const current = profile?.username || ''
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setValue(current) }, [current])
  const clean = value.trim().toLowerCase()

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await setUsername(clean)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (err) { setError(err.message || 'Could not save username.') }
    finally { setBusy(false) }
  }

  return <form onSubmit={submit}>
    <label className="field">Username
      <input
        value={value}
        onChange={(event) => setValue(event.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20))}
        placeholder="e.g. night_owl"
        autoComplete="off"
        autoCapitalize="none"
        maxLength={20}
      />
    </label>
    <p className="settings-desc">3 to 20 letters, numbers or underscores. Friends find you by this name.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="btn btn-primary" type="submit" disabled={busy || !USERNAME_RE.test(clean) || clean === current}>
      {saved ? <><Check size={15} /> Saved</> : current ? 'Change username' : 'Save username'}
    </button>
  </form>
}