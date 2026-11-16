import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { ForegroundService, Importance } from '@capawesome-team/capacitor-android-foreground-service'

const isAndroid = Capacitor.getPlatform() === 'android'
const NOTIFICATION_ID = 1
const CHANNEL = 'playback'
const BUTTON = { prev: 1, toggle: 2, next: 3 }

// Keeps the app alive in the background and shows a notification with the song + prev / play-pause / next.
// controlsRef.current = { prev, toggle, next } (always the latest handlers).
export function useBackgroundPlayback({ track, playing, controlsRef }) {
  const started = useRef(false)
  const queue = useRef(Promise.resolve()) // runs the native calls one at a time
  const trackId = track?.id
  const title = track?.title
  const artist = track?.artist

  // Notification button taps
  useEffect(() => {
    if (!isAndroid) return undefined
    let cancelled = false
    let handle = null
    ForegroundService.addListener('buttonClicked', (event) => {
      const controls = controlsRef.current || {}
      if (event.buttonId === BUTTON.prev) controls.prev?.()
      else if (event.buttonId === BUTTON.toggle) controls.toggle?.()
      else if (event.buttonId === BUTTON.next) controls.next?.()
    }).then((listener) => { if (cancelled) listener.remove(); else handle = listener })
    return () => { cancelled = true; handle?.remove() }
  }, [controlsRef])

  // Start / update / stop the notification
  useEffect(() => {
    if (!isAndroid) return
    const run = (task) => { queue.current = queue.current.then(task).catch((error) => console.warn('Notification failed:', error)) }

    if (!trackId) {
      if (started.current) {
        started.current = false
        run(() => ForegroundService.stopForegroundService())
      }
      return
    }
    if (!started.current && !playing) return // only start once music is actually playing

    const options = {
      id: NOTIFICATION_ID,
      title: title || 'Jamunity',
      body: artist || '',
      smallIcon: 'ic_launcher',
      silent: true,
      notificationChannelId: CHANNEL,
      buttons: [
        { id: BUTTON.prev, title: 'Previous' },
        { id: BUTTON.toggle, title: playing ? 'Pause' : 'Play' },
        { id: BUTTON.next, title: 'Next' },
      ],
    }

    run(async () => {
      if (!started.current) {
        const permission = await ForegroundService.checkPermissions()
        if (permission.display !== 'granted') await ForegroundService.requestPermissions()
        await ForegroundService.createNotificationChannel({
          id: CHANNEL, name: 'Music playback', description: 'Controls for the song that is playing', importance: Importance.Low,
        })
        await ForegroundService.startForegroundService(options)
        started.current = true
      } else {
        await ForegroundService.updateForegroundService(options)
      }
    })
  }, [trackId, title, artist, playing])

  // Remove the notification when the app is closed
  useEffect(() => () => {
    if (isAndroid && started.current) ForegroundService.stopForegroundService().catch(() => {})
  }, [])
}