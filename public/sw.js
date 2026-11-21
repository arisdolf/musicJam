const SHELL_CACHE = 'melojam-shell-v1'
const SHELL_FILES = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
]

async function cacheAppAssets(cache) {
  const page = await fetch('/')
  if (!page.ok) throw new Error('Could not fetch the app shell')
  const html = await page.clone().text()
  await cache.put('/', page)

  const pending = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)]
    .map((match) => new URL(match[1], self.location.origin).href)
  const seen = new Set()

  while (pending.length) {
    const assetUrl = pending.pop()
    if (seen.has(assetUrl) || new URL(assetUrl).origin !== self.location.origin) continue
    seen.add(assetUrl)
    const response = await fetch(assetUrl)
    if (!response.ok) continue
    const source = assetUrl.endsWith('.js') ? await response.clone().text() : ''
    await cache.put(assetUrl, response)

    for (const match of source.matchAll(/(?:import\s*\(\s*|\bfrom\s*)["']([^"']+\.js)["']/g)) {
      const dependency = new URL(match[1], assetUrl)
      if (dependency.origin === self.location.origin && dependency.pathname.includes('/assets/')) pending.push(dependency.href)
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    await cache.addAll(SHELL_FILES)
    await cacheAppAssets(cache)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('melojam-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put('/', response.clone())
        return response
      } catch {
        return (await cache.match('/')) || Response.error()
      }
    })())
    return
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination) && !url.pathname.startsWith('/assets/')) return
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
    return response
  })())
})

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
