import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential,
  updatePassword, deleteUser,
} from 'firebase/auth'
import { ref, onValue, push, set, remove } from 'firebase/database'
import { auth, db } from '../../services/firebase'

const AccountContext = createContext(null)
export const useAccount = () => useContext(AccountContext)

const MAX_TRACKS = 200

const toUser = (u) => u && ({
  id: u.uid,
  name: u.displayName || u.email?.split('@')[0] || 'Listener',
  email: u.email || '',
  hasPassword: u.providerData.some((p) => p.providerId === 'password'),
})

const trackNode = (t, position) => ({
  title: String(t.title).slice(0, 300),
  artist: String(t.artist || '').slice(0, 200),
  thumbnail: t.thumbnail || null,
  duration: t.duration || null,
  lyricsId: t.lyricsId || null,
  position,
  addedAt: Date.now(),
})

const parsePlaylists = (val) => Object.entries(val || {}).map(([id, p]) => ({
  id,
  name: p.name,
  createdAt: p.createdAt || 0,
  tracks: Object.entries(p.tracks || {})
    .map(([videoId, t]) => ({
      id: videoId, title: t.title, artist: t.artist || '', thumbnail: t.thumbnail || null,
      ...(t.duration ? { duration: t.duration } : {}),
      ...(t.lyricsId ? { lyricsId: t.lyricsId } : {}),
      position: t.position ?? 0,
    }))
    .sort((a, b) => a.position - b.position)
    .map(({ position, ...track }) => track), // eslint-disable-line no-unused-vars
})).sort((a, b) => b.createdAt - a.createdAt)

const uid = () => {
  const id = auth.currentUser?.uid
  if (!id) throw new Error('Not logged in.')
  return id
}

export function AccountProvider({ children }) {
  const [user, setUser] = useState(null)
  const [playlists, setPlaylists] = useState([])
  const [playlistsReady, setPlaylistsReady] = useState(false)
  const [playlistsError, setPlaylistsError] = useState('')
  const [authMode, setAuthMode] = useState(null)
  const [loadingAccount, setLoadingAccount] = useState(true)
  const playlistsRef = useRef([])
  const userId = user?.id

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(toUser(u)); setLoadingAccount(false) }), [])

  // Live playlists: any change (even from another device) shows up instantly.
  useEffect(() => {
    if (!userId) { setPlaylists([]); setPlaylistsReady(false); setPlaylistsError(''); return undefined }
    setPlaylistsReady(false); setPlaylistsError('')
    return onValue(ref(db, `playlists/${userId}`),
      (snap) => {
        const list = parsePlaylists(snap.val())
        playlistsRef.current = list
        setPlaylists(list); setPlaylistsReady(true)
      },
      (error) => { setPlaylistsError(error.message || 'Could not load your playlists.'); setPlaylistsReady(true) })
  }, [userId])

  // ── Auth ──────────────────────────────────────────────────────────────
  const signUp = useCallback(async ({ name, email, password }) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateProfile(cred.user, { displayName: name.trim().slice(0, 60) })
    setUser(toUser(auth.currentUser)); setAuthMode(null)
  }, [])

  const logIn = useCallback(async ({ email, password }) => {
    await signInWithEmailAndPassword(auth, email.trim(), password)
    setAuthMode(null)
  }, [])

  const logInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, new GoogleAuthProvider())
    setAuthMode(null)
  }, [])

  const logOut = useCallback(() => signOut(auth), [])

  const reauth = async (password) => {
    const u = auth.currentUser
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password))
  }

  const updateName = useCallback(async (name) => {
    await updateProfile(auth.currentUser, { displayName: name.trim().slice(0, 60) })
    setUser(toUser(auth.currentUser))
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await reauth(currentPassword)
    await updatePassword(auth.currentUser, newPassword)
  }, [])

  const deleteAccount = useCallback(async (password) => {
    const u = auth.currentUser
    if (u.providerData.some((p) => p.providerId === 'password')) await reauth(password)
    await remove(ref(db, `playlists/${u.uid}`))
    await deleteUser(u)
  }, [])

  // ── Playlists ─────────────────────────────────────────────────────────
  const createPlaylist = useCallback(async (name, tracks = []) => {
    const id = uid()
    const clean = name.trim().slice(0, 60)
    if (!clean) throw new Error('Enter a playlist name.')
    const seen = new Set()
    const unique = tracks.filter((t) => t?.id && !seen.has(t.id) && seen.add(t.id)).slice(0, MAX_TRACKS)
    const node = push(ref(db, `playlists/${id}`))
    await set(node, {
      name: clean,
      createdAt: Date.now(),
      tracks: Object.fromEntries(unique.map((t, i) => [t.id, trackNode(t, i)])),
    })
    return node.key
  }, [])

  const addToPlaylist = useCallback(async (playlistId, track) => {
    const id = uid()
    const playlist = playlistsRef.current.find((p) => p.id === playlistId)
    if (!playlist) throw new Error('Playlist not found.')
    if (playlist.tracks.some((t) => t.id === track.id)) return
    if (playlist.tracks.length >= MAX_TRACKS) throw new Error(`A playlist can hold up to ${MAX_TRACKS} songs.`)
    await set(ref(db, `playlists/${id}/${playlistId}/tracks/${track.id}`), trackNode(track, playlist.tracks.length))
  }, [])

  const removeFromPlaylist = useCallback(async (playlistId, trackId) => {
    await remove(ref(db, `playlists/${uid()}/${playlistId}/tracks/${trackId}`))
  }, [])

  const renamePlaylist = useCallback(async (playlistId, name) => {
    const clean = name.trim().slice(0, 60)
    if (!clean) throw new Error('Enter a playlist name.')
    await set(ref(db, `playlists/${uid()}/${playlistId}/name`), clean)
  }, [])

  const deletePlaylist = useCallback(async (playlistId) => {
    await remove(ref(db, `playlists/${uid()}/${playlistId}`))
  }, [])

  const value = useMemo(() => ({
    user, playlists, playlistsReady, playlistsError, authMode, loadingAccount,
    openAuth: setAuthMode, closeAuth: () => setAuthMode(null),
    signUp, logIn, logInWithGoogle, logOut, updateName, changePassword, deleteAccount,
    createPlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist,
  }), [user, playlists, playlistsReady, playlistsError, authMode, loadingAccount,
       signUp, logIn, logInWithGoogle, logOut, updateName, changePassword, deleteAccount,
       createPlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}