self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Lets browsers treat the site as an installable app. Nothing is cached here.
self.addEventListener('fetch', () => {})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return // the "Dismiss" button just closes it

  const data = event.notification.data || {}
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        client.postMessage({ type: 'jamroom:notification', data })
        return
      }
    }
    await self.clients.openWindow(data.roomCode ? `/?room=${data.roomCode}` : '/')
  })())
})