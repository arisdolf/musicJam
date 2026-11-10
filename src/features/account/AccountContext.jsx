import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from '../../services/api'

const AccountContext = createContext(null)
export const useAccount = () => useContext(AccountContext)

export function AccountProvider({ children }) {
  const [user, setUser] = useState(null)
  const [playlists, setPlaylists] = useState([])
  const [authMode, setAuthMode] = useState(null)
  const [loadingAccount, setLoadingAccount] = useState(Boolean(getToken()))

  const refreshPlaylists = useCallback(async () => {
    if (!getToken()) { setPlaylists([]); return }
    const data = await api('/api/playlists')
    setPlaylists(data.playlists || [])
  }, [])

  useEffect(() => {
    if (!getToken()) { setLoadingAccount(false); return }
    let active = true
    api('/api/auth/me').then(({ user: current }) => { if (active) setUser(current); return refreshPlaylists() })
      .catch(() => { setToken(null); if (active) { setUser(null); setPlaylists([]) } })
      .finally(() => { if (active) setLoadingAccount(false) })
    return () => { active = false }
  }, [refreshPlaylists])

  const signUp = useCallback(async (details) => {
    const data = await api('/api/auth/signup', { method: 'POST', body: details })
    setToken(data.token); setUser(data.user); setPlaylists([]); setAuthMode(null)
  }, [])
  const logIn = useCallback(async (details) => {
    const data = await api('/api/auth/login', { method: 'POST', body: details })
    setToken(data.token); setUser(data.user); await refreshPlaylists(); setAuthMode(null)
  }, [refreshPlaylists])
  const logOut = useCallback(() => { setToken(null); setUser(null); setPlaylists([]) }, [])

  const createPlaylist = useCallback(async (name, tracks = []) => {
    const { playlist } = await api('/api/playlists', { method: 'POST', body: { name } })
    for (const track of tracks) await api(`/api/playlists/${playlist.id}/tracks`, { method: 'POST', body: track })
    await refreshPlaylists()
    return playlist.id
  }, [refreshPlaylists])
  const addToPlaylist = useCallback(async (playlistId, track) => {
    await api(`/api/playlists/${playlistId}/tracks`, { method: 'POST', body: track })
    await refreshPlaylists()
  }, [refreshPlaylists])
  const removeFromPlaylist = useCallback(async (playlistId, trackId) => {
    await api(`/api/playlists/${playlistId}/tracks/${encodeURIComponent(trackId)}`, { method: 'DELETE' })
    await refreshPlaylists()
  }, [refreshPlaylists])
  const deletePlaylist = useCallback(async (playlistId) => {
    await api(`/api/playlists/${playlistId}`, { method: 'DELETE' })
    await refreshPlaylists()
  }, [refreshPlaylists])

  const value = useMemo(() => ({ user, playlists, authMode, loadingAccount, openAuth: setAuthMode, closeAuth: () => setAuthMode(null), signUp, logIn, logOut, createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist }), [user, playlists, authMode, loadingAccount, signUp, logIn, logOut, createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
