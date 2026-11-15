export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}

// Mobile Chrome only allows notifications through the service worker, so this goes through it.
export async function showSystemNotification({ title, body, roomCode, tag }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (!reg) return false
    await reg.showNotification(title, {
      body,
      tag,
      renotify: true,
      icon: '/icon-192.png',   // big icon next to the text
      badge: '/badge-72.png',  // small white icon in the Android status bar
      vibrate: [120, 60, 120],
      actions: roomCode
        ? [{ action: 'join', title: 'Join room' }, { action: 'dismiss', title: 'Dismiss' }]
        : [],
      data: { roomCode },
    })
    return true
  } catch { return false }
}