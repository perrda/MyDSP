/* MyDSP offline shell — network-first for HTML, cache-first for hashed assets */
const CACHE = 'mydsp-v1.0.0'

self.addEventListener('install', (event) => {
  // Activate immediately so we don't keep serving a broken old shell
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/favicon.svg', '/manifest.webmanifest'])))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  const isHtml =
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    (req.headers.get('accept') || '').includes('text/html')

  // Always prefer network for the app shell so new builds aren't blocked by old HTML
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html'))),
    )
    return
  }

  // Hashed assets: cache-first is safe because filenames change each build
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.png'))) {
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
