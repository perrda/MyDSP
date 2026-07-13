/* MyDSP offline shell — network-first for HTML, cache-first for hashed assets + todo reminders */
const CACHE = 'mydsp-v1.1.0'
const REMINDER_DB = 'mydsp_sw_reminders'
const REMINDER_STORE = 'schedule'
const FIRED_STORE = 'fired'

/** @type {Map<string, number>} */
const reminderTimers = new Map()

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

// --- Todo reminders (Background Sync / Periodic Sync / message schedule) ---

function openReminderDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(REMINDER_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(REMINDER_STORE)) db.createObjectStore(REMINDER_STORE)
      if (!db.objectStoreNames.contains(FIRED_STORE)) db.createObjectStore(FIRED_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(store, key) {
  const db = await openReminderDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

async function idbPut(store, key, value) {
  const db = await openReminderDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value, key)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

async function loadFiredSet() {
  const raw = (await idbGet(FIRED_STORE, 'keys')) || []
  return new Set(Array.isArray(raw) ? raw : [])
}

async function markFired(key) {
  const set = await loadFiredSet()
  set.add(key)
  const arr = [...set].slice(-200)
  await idbPut(FIRED_STORE, 'keys', arr)
}

async function fireReminder(r) {
  const fired = await loadFiredSet()
  if (fired.has(r.key)) return
  await self.registration.showNotification('Todo reminder', {
    body: r.title,
    tag: r.key,
    data: { url: '/todos', key: r.key },
    renotify: true,
  })
  await markFired(r.key)
  // Notify open clients so they mark localStorage fired too
  const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clientsList) {
    client.postMessage({ type: 'TODO_REMINDER_FIRED', key: r.key })
  }
}

function clearReminderTimers() {
  for (const t of reminderTimers.values()) clearTimeout(t)
  reminderTimers.clear()
}

async function scheduleReminders(reminders) {
  clearReminderTimers()
  await idbPut(REMINDER_STORE, 'items', reminders || [])
  const fired = await loadFiredSet()
  const now = Date.now()
  for (const r of reminders || []) {
    if (!r?.key || fired.has(r.key)) continue
    if (r.fireAt <= now) {
      // Due now / missed within window — fire immediately
      if (now - r.fireAt <= 24 * 60 * 60 * 1000) {
        await fireReminder(r)
      }
      continue
    }
    const delay = Math.min(r.fireAt - now, 2147483647)
    const timer = setTimeout(() => {
      void fireReminder(r)
    }, delay)
    reminderTimers.set(r.key, timer)
  }
}

async function checkDueReminders() {
  const reminders = (await idbGet(REMINDER_STORE, 'items')) || []
  const fired = await loadFiredSet()
  const now = Date.now()
  for (const r of reminders) {
    if (!r?.key || fired.has(r.key)) continue
    if (r.fireAt <= now && now - r.fireAt <= 24 * 60 * 60 * 1000) {
      await fireReminder(r)
    }
  }
  // Re-arm timers for future ones
  await scheduleReminders(reminders.filter((r) => r.fireAt > now || !fired.has(r.key)))
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'SCHEDULE_TODO_REMINDERS') {
    event.waitUntil(scheduleReminders(data.reminders || []))
  }
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'todo-reminders') {
    event.waitUntil(checkDueReminders())
  }
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'todo-reminders') {
    event.waitUntil(checkDueReminders())
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/todos'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'TODO_REMINDER_CLICK', url })
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
