import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ref, onValue, get, set, push, remove, update, runTransaction, serverTimestamp,
  query, orderByKey, startAt, endAt, limitToFirst,
} from 'firebase/database'
import { auth, db } from '../../services/firebase'
import { useAccount } from '../account/AccountContext'

const FriendsContext = createContext(null)
export const useFriends = () => useContext(FriendsContext)

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
const INVITE_TTL = 2 * 60 * 60 * 1000 // invites older than this are ignored and cleaned up

// System notification, only when the tab is hidden or not focused.
function alertUser(title, body, data) {
  if (!document.hidden && document.hasFocus()) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const options = { body, tag: data.tag, renotify: true, data }
  const fallback = () => {
    try {
      const note = new Notification(title, options)
      note.onclick = () => {
        window.focus()
        window.dispatchEvent(new CustomEvent('jamroom:notification', { detail: data }))
        note.close()
      }
    } catch { /* unsupported */ }
  }
  if (!navigator.serviceWorker) { fallback(); return }
  navigator.serviceWorker.getRegistration()
    .then((reg) => (reg?.showNotification ? reg.showNotification(title, options) : fallback()))
    .catch(fallback)
}

export function FriendsProvider({ children }) {
  const { user } = useAccount()
  const userId = user?.id
  const [profile, setProfile] = useState(null)
  const [profileReady, setProfileReady] = useState(false)
  const [friendIds, setFriendIds] = useState([])
  const [names, setNames] = useState({})
  const [requests, setRequests] = useState([])
  const [invites, setInvites] = useState([])
  const profileRef = useRef(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  // My profile (username)
  useEffect(() => {
    if (!userId) { profileRef.current = null; setProfile(null); setProfileReady(false); return undefined }
    return onValue(ref(db, `users/${userId}`),
      (snap) => { profileRef.current = snap.val(); setProfile(snap.val()); setProfileReady(true) },
      () => setProfileReady(true))
  }, [userId])

  // My friends, and each friend's live username
  useEffect(() => {
    if (!userId) { setFriendIds([]); return undefined }
    return onValue(ref(db, `friends/${userId}`), (snap) => setFriendIds(Object.keys(snap.val() || {})))
  }, [userId])

  useEffect(() => {
    const offs = friendIds.map((id) => onValue(ref(db, `users/${id}/username`),
      (snap) => setNames((current) => ({ ...current, [id]: snap.val() || 'unknown' }))))
    return () => offs.forEach((off) => off())
  }, [friendIds])

  // Incoming friend requests (alerts for new ones, not the ones already waiting)
  useEffect(() => {
    if (!userId) { setRequests([]); return undefined }
    let seen = null
    return onValue(ref(db, `friendRequests/${userId}`), (snap) => {
      const list = Object.entries(snap.val() || {})
        .map(([uid, value]) => ({ uid, username: value.fromUsername || 'Someone', at: value.at || 0 }))
        .sort((a, b) => b.at - a.at)
      if (seen) {
        for (const request of list) {
          if (!seen.has(request.uid)) {
            alertUser('Friend request', `@${request.username} wants to be your friend`, { tag: `friend-${request.uid}`, view: 'friends' })
          }
        }
      }
      seen = new Set(list.map((request) => request.uid))
      setRequests(list)
    })
  }, [userId])

  // Room invites
  useEffect(() => {
    if (!userId) { setInvites([]); return undefined }
    let seen = null
    return onValue(ref(db, `invites/${userId}`), (snap) => {
      const now = Date.now()
      const all = Object.entries(snap.val() || {}).map(([id, value]) => ({ id, ...value }))
      for (const invite of all) {
        if (now - (invite.at || 0) > INVITE_TTL) remove(ref(db, `invites/${userId}/${invite.id}`)).catch(() => {})
      }
      const list = all.filter((invite) => now - (invite.at || 0) <= INVITE_TTL).sort((a, b) => b.at - a.at)
      if (seen) {
        for (const invite of list) {
          if (!seen.has(invite.id)) {
            alertUser(`@${invite.fromName} invited you`, `Join room ${invite.roomCode} and listen together`, { tag: `invite-${invite.id}`, roomCode: invite.roomCode })
          }
        }
      }
      seen = new Set(list.map((invite) => invite.id))
      setInvites(list)
    })
  }, [userId])

  const friends = useMemo(() => friendIds
    .map((uid) => ({ uid, username: names[uid] || '…' }))
    .sort((a, b) => a.username.localeCompare(b.username)), [friendIds, names])

  // Claims the name first (atomic), then saves it to the profile, then frees the old name.
  const setUsername = useCallback(async (raw) => {
    const name = String(raw || '').trim().toLowerCase()
    if (!USERNAME_RE.test(name)) throw new Error('Use 3 to 20 letters, numbers or underscores.')
    const id = auth.currentUser?.uid
    if (!id) throw new Error('Not logged in.')
    const old = profileRef.current?.username
    if (old === name) return
    try {
      const claim = await runTransaction(ref(db, `usernames/${name}`), (current) => (current === null || current === id ? id : undefined))
      if (!claim.committed) throw new Error('That username is taken.')
    } catch (error) {
      if (error.code === 'PERMISSION_DENIED' || /permission_denied/i.test(error.message)) {
        throw new Error('That username is taken or the database rules are not set up yet.')
      }
      throw error
    }
    try {
      await set(ref(db, `users/${id}/username`), name)
    } catch (error) {
      await remove(ref(db, `usernames/${name}`)).catch(() => {})
      throw error
    }
    if (old && old !== name) await remove(ref(db, `usernames/${old}`)).catch(() => {})
  }, [])

  // Prefix search on usernames. Each result says how it relates to me.
  const searchUsers = useCallback(async (raw) => {
    const q = String(raw || '').trim().toLowerCase().replace(/^@/, '')
    const me = auth.currentUser?.uid
    if (q.length < 2 || !me) return []
    const snap = await get(query(ref(db, 'usernames'), orderByKey(), startAt(q), endAt(`${q}\uf8ff`), limitToFirst(8)))
    const found = Object.entries(snap.val() || {}).filter(([, uid]) => uid !== me)
    return Promise.all(found.map(async ([username, uid]) => {
      let status = 'none'
      if (friendIds.includes(uid)) status = 'friend'
      else if (requests.some((request) => request.uid === uid)) status = 'incoming'
      else if ((await get(ref(db, `friendRequests/${uid}/${me}`))).exists()) status = 'sent'
      return { uid, username, status }
    }))
  }, [friendIds, requests])

  const sendRequest = useCallback(async (toUid) => {
    const me = auth.currentUser?.uid
    const username = profileRef.current?.username
    if (!me) throw new Error('Not logged in.')
    if (!username) throw new Error('Choose a username first.')
    await set(ref(db, `friendRequests/${toUid}/${me}`), { fromUsername: username, at: serverTimestamp() })
  }, [])

  const cancelRequest = useCallback(async (toUid) => {
    await remove(ref(db, `friendRequests/${toUid}/${auth.currentUser.uid}`))
  }, [])

  const acceptRequest = useCallback(async (fromUid) => {
    const me = auth.currentUser.uid
    await update(ref(db), {
      [`friends/${me}/${fromUid}`]: true,
      [`friends/${fromUid}/${me}`]: true,
      [`friendRequests/${me}/${fromUid}`]: null,
    })
  }, [])

  const declineRequest = useCallback(async (fromUid) => {
    await remove(ref(db, `friendRequests/${auth.currentUser.uid}/${fromUid}`))
  }, [])

  const removeFriend = useCallback(async (uid) => {
    const me = auth.currentUser.uid
    await update(ref(db), { [`friends/${me}/${uid}`]: null, [`friends/${uid}/${me}`]: null })
  }, [])

  const sendInvite = useCallback(async (friendUid, roomCode) => {
    const me = auth.currentUser?.uid
    const username = profileRef.current?.username
    if (!me || !username) throw new Error('Choose a username first.')
    if (!/^[A-Z0-9]{4,8}$/.test(roomCode || '')) throw new Error('Join a room first.')
    await push(ref(db, `invites/${friendUid}`), { fromUid: me, fromName: username, roomCode, at: serverTimestamp() })
  }, [])

  const dismissInvite = useCallback(async (id) => {
    await remove(ref(db, `invites/${auth.currentUser.uid}/${id}`)).catch(() => {})
  }, [])

  const value = useMemo(() => ({
    profile, profileReady, friends, requests, invites, pendingCount: requests.length + invites.length,
    setUsername, searchUsers, sendRequest, cancelRequest, acceptRequest, declineRequest, removeFriend, sendInvite, dismissInvite,
  }), [profile, profileReady, friends, requests, invites,
       setUsername, searchUsers, sendRequest, cancelRequest, acceptRequest, declineRequest, removeFriend, sendInvite, dismissInvite])

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
}