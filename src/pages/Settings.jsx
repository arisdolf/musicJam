// src/pages/Settings.jsx
  import { useState } from 'react'
  import UsernameForm from '../components/UsernameForm'
  import { useAccount } from '../features/account/AccountContext'
 import { User, Lock, LogOut, Trash2, Check, Monitor, AtSign, Sun, Moon, Gauge, Users, Bell, ChevronRight } from 'lucide-react'
import Quota from './Quota'
import Friends from './Friends'
import { useFriends } from '../features/friends/FriendsContext'
import { getTheme, applyTheme } from '../utils/theme'
import { ensureNotificationPermission } from '../utils/notify'
import { useTopbar } from '../components/TopBarContext'
// ADJUST these to match the routes in your server's auth file.
const THEMES = [
  { id: 'light',  label: 'Light',  icon: Sun },
  { id: 'dark',   label: 'Dark',   icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]
export default function Settings({ roomCode, section, onSectionChange }) {
  const { pendingCount } = useFriends()
  const [theme, setTheme] = useState(getTheme)
  const [notifPerm, setNotifPerm] = useState(() => 'Notification' in window ? Notification.permission : 'unsupported')
  const chooseTheme = (mode) => { setTheme(mode); applyTheme(mode) }
  const { user, logOut, updateName, changePassword, deleteAccount } = useAccount()
  useTopbar(section === 'friends' ? 'Friends' : section === 'quota' ? 'API Quota' : '', section ? () => onSectionChange(null) : null)
  const [name, setName]           = useState(user?.name || '')
  const [nameSaved, setNameSaved] = useState(false)
  const [nameErr, setNameErr]     = useState('')

  const [currPw, setCurrPw]   = useState('')
  const [newPw, setNewPw]     = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [pwErr, setPwErr]     = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [delErr, setDelErr]               = useState('')
  const [busy, setBusy]                   = useState(false)

 const saveName = async (e) => {
  e.preventDefault()
  const cleanName = name.trim()
  if (!cleanName) return
  setBusy(true); setNameErr('')
  try {
    await updateName(cleanName)
    setNameSaved(true); setTimeout(() => setNameSaved(false), 2000)
  } catch (err) { setNameErr(err.message) }
  finally { setBusy(false) }
}

  const savePassword = async (e) => {
  e.preventDefault()
  if (newPw.length < 6) { setPwErr('Password must be at least 6 characters.'); return }
  setBusy(true); setPwErr('')
  try {
    await changePassword(currPw, newPw)
    setCurrPw(''); setNewPw('')
    setPwSaved(true); setTimeout(() => setPwSaved(false), 2000)
  } catch (err) {
    setPwErr(err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
      ? 'Current password is incorrect.' : err.message)
  } finally { setBusy(false) }
}

  const handleDelete = async () => {
  if (deleteConfirm !== 'DELETE') { setDelErr('Type DELETE to confirm.'); return }
  setBusy(true); setDelErr('')
  try { await deleteAccount(currPw) }   // see note below
  catch (err) { setDelErr(err.message); setBusy(false) }
}
  if (section === 'friends' || section === 'quota') {
    return <div className="settings-page settings-sub">
      {section === 'friends' ? <Friends roomCode={roomCode} /> : <Quota />}
    </div>
  }
  return (
    <main className="settings-page">
      <h1>Settings</h1>

      <section className="settings-card">
  <div className="settings-card-header"><Monitor size={18} /><h2>Appearance</h2></div>
  <p className="settings-desc">Choose how Jamroom looks. System follows your device.</p>
  <div className="theme-options" role="radiogroup" aria-label="Theme">
    {THEMES.map(({ id, label, icon: Icon }) => (
      <button key={id} type="button" role="radio" aria-checked={theme === id}
        className={`theme-option${theme === id ? ' active' : ''}`} onClick={() => chooseTheme(id)}>
        <Icon size={18} /><span>{label}</span>
      </button>
    ))}
  </div>
</section>

<section className="settings-card">
  <div className="settings-card-header"><Users size={18} /><h2>Social &amp; usage</h2></div>
  <button className="settings-row" onClick={() => onSectionChange('friends')}>
    <Users size={18} /><span>Friends</span>
    {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
    <ChevronRight size={17} />
  </button>
  <button className="settings-row" onClick={() => onSectionChange('quota')}>
    <Gauge size={18} /><span>API Quota</span><ChevronRight size={17} />
  </button>
</section>

<section className="settings-card">
  <div className="settings-card-header"><Bell size={18} /><h2>Notifications</h2></div>
  <p className="settings-desc">Get a phone notification when a friend invites you to a room.</p>
  {notifPerm === 'granted' && <div className="appearance-status"><Check size={14} /> On</div>}
  {notifPerm === 'denied' && <p className="settings-desc">Blocked. Allow notifications for this site in your browser settings.</p>}
  {notifPerm === 'unsupported' && <p className="settings-desc">This browser does not support notifications.</p>}
  {notifPerm === 'default' && <button className="btn btn-primary" onClick={async () => setNotifPerm(await ensureNotificationPermission())}>Turn on notifications</button>}
</section>

            <section className="settings-card">
        <div className="settings-card-header"><AtSign size={18} /><h2>Username</h2></div>
        <UsernameForm />
      </section>

      {/* ── Profile ── */}
      <section className="settings-card">
        <div className="settings-card-header"><User size={18} /><h2>Profile</h2></div>
        <form onSubmit={saveName}>
          <label className="field">Display name
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={60} />
          </label>
          <label className="field">Email
            <input value={user?.email || ''} readOnly className="readonly" />
          </label>
          {nameErr && <div className="form-error">{nameErr}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
            {nameSaved ? <><Check size={15} /> Saved</> : 'Save changes'}
          </button>
        </form>
      </section>

      {/* ── Change password ── */}
      <section className="settings-card">
        <div className="settings-card-header"><Lock size={18} /><h2>Change password</h2></div>
        <form onSubmit={savePassword}>
          <label className="field">Current password
            <input type="password" value={currPw} onChange={e => setCurrPw(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="field">New password
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
          </label>
          {pwErr && <div className="form-error">{pwErr}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || !currPw || !newPw}>
            {pwSaved ? <><Check size={15} /> Saved</> : 'Update password'}
          </button>
        </form>
      </section>

      {/* ── Sign out ── */}
      <section className="settings-card">
        <div className="settings-card-header"><LogOut size={18} /><h2>Session</h2></div>
        <p className="settings-desc">You are signed in as <strong>{user?.email}</strong>.</p>
        <button className="btn" onClick={logOut}>Sign out</button>
      </section>

      {/* ── Danger zone ── */}
      <section className="settings-card danger-card">
        <div className="settings-card-header"><Trash2 size={18} /><h2>Delete account</h2></div>
        <p className="settings-desc">This permanently deletes your account and all playlists. This cannot be undone.</p>
        <label className="field">Type <strong>DELETE</strong> to confirm
          <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
        </label>
        {delErr && <div className="form-error">{delErr}</div>}
        <button className="btn btn-danger" onClick={handleDelete} disabled={busy || deleteConfirm !== 'DELETE'}>
          Delete my account
        </button>
      </section>
    </main>
    
  )
  
}