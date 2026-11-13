// src/features/account/AccountContext.jsx
// Auth + playlists, both through your own API (no Firebase).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from '../../services/api'

const AccountContext = createContext(null)
export const useAccount = () => useContext(AccountContext)

// The server sends nulls for missing fields; the rest of the app expects them left out.
const normalizeTrack = (t) => ({
  id: t.id, title: t.title, artist: t.artist, thumbnail: t.thumbnail || null,
  ...(t.duration ? { duration: t.duration } : {}),
  ...(t.lyricsId ? { lyricsId: t.lyricsId } : {}),
})
const normalizePlaylist = (p) => ({ ...p, tracks: (p.tracks || []).map(normalizeTrack) })

const requireLogin = () => { if (!getToken()) throw new Error('Not logged in.') }

export function AccountProvider({ children }) {
  const [user, setUser]                       = useState(null)
  const [playlists, setPlaylists]             = useState([])
  const [playlistsReady, setPlaylistsReady]   = useState(false)
  const [playlistsError, setPlaylistsError]   = useState('')
  const [authMode, setAuthMode]               = useState(null)   // 'login' | 'signup' | null
  const [loadingAccount, setLoadingAccount]   = useState(true)
  const userId = user?.id

  // ── Restore the session from the saved token ─────────────────────────────
  useEffect(() => {
    if (!getToken()) { setLoadingAccount(false); return undefined }
    let cancelled = false
    api('/api/auth/me')
      .then(({ user }) => { if (!cancelled) setUser(user) })
      .catch((error) => { if (error.status === 401) setToken(null) })
      .finally(() => { if (!cancelled) setLoadingAccount(false) })
    return () => { cancelled = true }
  }, [])

  // ── Load this user's playlists whenever the logged-in user changes ───────
  useEffect(() => {
    if (!userId) {
      setPlaylists([]); setPlaylistsReady(false); setPlaylistsError('')
      return undefined
    }
    let cancelled = false
    setPlaylistsReady(false); setPlaylistsError('')
    api('/api/playlists')
      .then(({ playlists }) => { if (!cancelled) setPlaylists(playlists.map(normalizePlaylist)) })
      .catch((error) => {
        if (cancelled) return
        if (error.status === 401) { setToken(null); setUser(null); return } // token expired
        setPlaylistsError(error.message || 'Could not load your playlists.')
      })
      .finally(() => { if (!cancelled) setPlaylistsReady(true) })
    return () => { cancelled = true }
  }, [userId])

  // ── Auth actions ─────────────────────────────────────────────────────────
  const signUp = useCallback(async (fields) => {
    const { token, user } = await api('/api/auth/signup', { method: 'POST', body: fields })
    setToken(token); setUser(user); setAuthMode(null)
  }, [])

  const logIn = useCallback(async (fields) => {
    const { token, user } = await api('/api/auth/login', { method: 'POST', body: fields })
    setToken(token); setUser(user); setAuthMode(null)
  }, [])

  const logInWithGoogle = useCallback(async () => {
    throw new Error('Google sign-in is coming soon.')
  }, [])

  const logOut = useCallback(async () => {
    setToken(null); setUser(null)
  }, [])

  // ── Playlist actions ─────────────────────────────────────────────────────
  // Every endpoint returns the full updated playlist, so state just swaps it in.
  const upsertPlaylist = useCallback((raw) => {
    const playlist = normalizePlaylist(raw)
    setPlaylists((current) => current.some((p) => p.id === playlist.id)
      ? current.map((p) => p.id === playlist.id ? playlist : p)
      : [playlist, ...current])
    return playlist
  }, [])

  const createPlaylist = useCallback(async (name, tracks = []) => {
    requireLogin()
    const { playlist } = await api('/api/playlists', {
      method: 'POST',
      body: { name, tracks: tracks.map(normalizeTrack) },
    })
    return upsertPlaylist(playlist).id
  }, [upsertPlaylist])

  const addToPlaylist = useCallback(async (playlistId, track) => {
    requireLogin()
    const { playlist } = await api(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: { track: normalizeTrack(track) },
    })
    upsertPlaylist(playlist)
  }, [upsertPlaylist])

  const removeFromPlaylist = useCallback(async (playlistId, trackId) => {
    requireLogin()
    const { playlist } = await api(`/api/playlists/${playlistId}/tracks/${encodeURIComponent(trackId)}`, { method: 'DELETE' })
    upsertPlaylist(playlist)
  }, [upsertPlaylist])

  const renamePlaylist = useCallback(async (playlistId, name) => {
    requireLogin()
    const cleanName = name.trim()
    if (!cleanName) throw new Error('Enter a playlist name.')
    const { playlist } = await api(`/api/playlists/${playlistId}`, { method: 'PATCH', body: { name: cleanName } })
    upsertPlaylist(playlist)
  }, [upsertPlaylist])

  const deletePlaylist = useCallback(async (playlistId) => {
    requireLogin()
    await api(`/api/playlists/${playlistId}`, { method: 'DELETE' })
    setPlaylists((current) => current.filter((p) => p.id !== playlistId))
  }, [])

  const value = useMemo(() => ({
    user, playlists, playlistsReady, playlistsError, authMode, loadingAccount,
    openAuth: setAuthMode, closeAuth: () => setAuthMode(null),
    signUp, logIn, logInWithGoogle, logOut,
    createPlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist,
  }), [user, playlists, playlistsReady, playlistsError, authMode, loadingAccount,
       signUp, logIn, logInWithGoogle, logOut,
       createPlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}