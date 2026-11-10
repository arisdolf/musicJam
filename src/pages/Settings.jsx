// src/pages/Settings.jsx
import { useState } from 'react'
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useAccount } from '../features/account/AccountContext'
import { User, Lock, LogOut, Trash2, Check, Monitor } from 'lucide-react'

export default function Settings() {
  const { user, logOut } = useAccount()
  const firebaseUser = auth.currentUser

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

  const isGoogle = firebaseUser?.providerData?.[0]?.providerId === 'google.com'

  const saveName = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true); setNameErr('')
    try {
      await updateProfile(firebaseUser, { displayName: name.trim() })
      setNameSaved(true); setTimeout(() => setNameSaved(false), 2000)
    } catch (err) { setNameErr(err.message) }
    finally { setBusy(false) }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (newPw.length < 6) { setPwErr('Password must be at least 6 characters.'); return }
    setBusy(true); setPwErr('')
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currPw)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updatePassword(firebaseUser, newPw)
      setCurrPw(''); setNewPw('')
      setPwSaved(true); setTimeout(() => setPwSaved(false), 2000)
    } catch (err) {
      setPwErr(err.code === 'auth/wrong-password' ? 'Current password is incorrect.' : err.message)
    } finally { setBusy(false) }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') { setDelErr('Type DELETE to confirm.'); return }
    setBusy(true); setDelErr('')
    try { await deleteUser(firebaseUser); await logOut() }
    catch (err) {
      setDelErr(err.code === 'auth/requires-recent-login'
        ? 'Please sign out and sign back in before deleting your account.'
        : err.message)
      setBusy(false)
    }
  }

  return (
    <main className="settings-page">
      <h1>Settings</h1>

      <section className="settings-card appearance-card">
        <div className="settings-card-header"><Monitor size={18} /><h2>Appearance</h2></div>
        <p className="settings-desc">Jamroom follows your device appearance automatically. Turn on dark mode in your system settings to use the dark theme here.</p>
        <div className="appearance-status"><span className="appearance-status-dot" /> Following device settings</div>
      </section>

      {/* ── Profile ── */}
      <section className="settings-card">
        <div className="settings-card-header"><User size={18} /><h2>Profile</h2></div>
        <form onSubmit={saveName}>
          <label className="field">Display name
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
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

      {/* ── Change Password (email accounts only) ── */}
      {!isGoogle && (
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
      )}

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
