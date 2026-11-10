// src/features/account/AccountContext.jsx
// Auth via Firebase Authentication; playlists via Firestore.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../../services/firebase'
import {
  subscribeToPlaylists,
  createPlaylist as fsCreatePlaylist,
  deletePlaylist as fsDeletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} from '../../services/firestore'

const AccountContext = createContext(null)
export const useAccount = () => useContext(AccountContext)

export function AccountProvider({ children }) {
  const [user, setUser]                   = useState(null)
  const [playlists, setPlaylists]         = useState([])
  const [authMode, setAuthMode]           = useState(null)   // 'login' | 'signup' | null
  const [loadingAccount, setLoadingAccount] = useState(true)
  const unsubPlaylistsRef = useRef(null)

  // ── Listen to Firebase Auth state ────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({ id: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email, email: firebaseUser.email })

        // Subscribe to this user's playlists in real-time.
        unsubPlaylistsRef.current?.()
        unsubPlaylistsRef.current = subscribeToPlaylists(firebaseUser.uid, setPlaylists)
      } else {
        setUser(null)
        setPlaylists([])
        unsubPlaylistsRef.current?.()
        unsubPlaylistsRef.current = null
      }
      setLoadingAccount(false)
    })
    return () => { unsub(); unsubPlaylistsRef.current?.() }
  }, [])

  // ── Auth actions ─────────────────────────────────────────────────────────
  const signUp = useCallback(async ({ name, email, password }) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(credential.user, { displayName: name })
    // Trigger a re-read so user.name is correct immediately.
    setUser({ id: credential.user.uid, name, email })
    setAuthMode(null)
  }, [])

  const logIn = useCallback(async ({ email, password }) => {
    await signInWithEmailAndPassword(auth, email, password)
    setAuthMode(null)
  }, [])

  const logInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider)
    setAuthMode(null)
  }, [])

  const logOut = useCallback(async () => {
    await signOut(auth)
  }, [])

  // ── Playlist actions ─────────────────────────────────────────────────────
  const createPlaylist = useCallback(async (name, tracks = []) => {
    if (!user) throw new Error('Not logged in.')
    const id = await fsCreatePlaylist(user.id, name)
    // Add initial tracks if provided (e.g. "Save queue as playlist").
    for (const track of tracks) {
      await addTrackToPlaylist(user.id, id, { id: track.id, title: track.title, artist: track.artist, thumbnail: track.thumbnail || null })
    }
    return id
  }, [user])

  const addToPlaylist = useCallback(async (playlistId, track) => {
    if (!user) throw new Error('Not logged in.')
    // Guard against duplicates (Firestore arrayUnion compares by deep equality).
    const playlist = playlists.find((p) => p.id === playlistId)
    if (playlist?.tracks.some((t) => t.id === track.id)) return
    await addTrackToPlaylist(user.id, playlistId, {
      id: track.id, title: track.title, artist: track.artist, thumbnail: track.thumbnail || null,
    })
  }, [user, playlists])

  const removeFromPlaylist = useCallback(async (playlistId, trackId) => {
    if (!user) throw new Error('Not logged in.')
    const playlist = playlists.find((p) => p.id === playlistId)
    const track = playlist?.tracks.find((t) => t.id === trackId)
    if (!track) return
    await removeTrackFromPlaylist(user.id, playlistId, track)
  }, [user, playlists])

  const deletePlaylist = useCallback(async (playlistId) => {
    if (!user) throw new Error('Not logged in.')
    await fsDeletePlaylist(user.id, playlistId)
  }, [user])

  const value = useMemo(() => ({
    user, playlists, authMode, loadingAccount,
    openAuth: setAuthMode, closeAuth: () => setAuthMode(null),
    signUp, logIn, logInWithGoogle, logOut,
    createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist,
  }), [user, playlists, authMode, loadingAccount,
       signUp, logIn, logInWithGoogle, logOut,
       createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
