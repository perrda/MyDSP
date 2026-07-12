/* MyDSP offline shell — cache-first for static assets */
const CACHE = 'mydsp-v0.6.1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'])),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets') || url.pathname === '/' || url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest'))) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
