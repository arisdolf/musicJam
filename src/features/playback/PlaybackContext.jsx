/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { playNow } from '../../utils/queue'
const PlaybackContext = createContext(null)
const STORAGE_KEY = 'jamroom:playback'
const EMPTY_PLAYBACK = { queue: [], current: 0, playing: false }

function readPlayback() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!stored || !Array.isArray(stored.queue)) return EMPTY_PLAYBACK
    return {
      queue: stored.queue,
      current: Math.max(0, Math.min(Number(stored.current) || 0, stored.queue.length - 1)),
      playing: Boolean(stored.playing),
    }
  } catch {
    return EMPTY_PLAYBACK
  }
}

export function PlaybackProvider({ children }) {
  const [state, setState] = useState(readPlayback)
  const playerRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* storage is optional */ }
  }, [state])

  const updatePlayback = useCallback((update) => {
    setState((current) => typeof update === 'function' ? update(current) : update)
  }, [])

  const registerPlayer = useCallback((player) => { playerRef.current = player }, [])

  const startVideo = useCallback((videoId) => {
  const player = playerRef.current
  if (!player || !videoId) return
  try {
    if (player.getVideoData?.()?.video_id === videoId) player.playVideo()
    else player.loadVideoById(videoId)
  } catch (error) { console.warn('Player not ready:', error) }
}, [])

   const playTrack = useCallback((track) => {
    if (!track?.id) return
    updatePlayback((current) => playNow(current, [track]))
    startVideo(track.id)
  }, [startVideo, updatePlayback])

  const addToQueue = useCallback((track) => {
    if (!track?.id) return
    updatePlayback((current) => current.queue.some((item) => item.id === track.id)
      ? current
      : { ...current, queue: [...current.queue, track], current: current.queue.length ? current.current : 0 })
  }, [updatePlayback])

  const playTracks = useCallback((tracks, index = 0) => {
    const list = Array.isArray(tracks) ? tracks : []
    const i = Math.max(0, Math.min(index, list.length - 1))
    if (!list[i]?.id) return
    updatePlayback((current) => playNow(current, list, i))
    startVideo(list[i].id)
  }, [startVideo, updatePlayback])

  return <PlaybackContext.Provider value={{ state, updatePlayback, registerPlayer, startVideo, playTrack, addToQueue, playTracks }}>
    {children}
  </PlaybackContext.Provider>
}

export function usePlayback() {
  const playback = useContext(PlaybackContext)
  if (!playback) throw new Error('usePlayback must be used within PlaybackProvider.')
  return playback
}
