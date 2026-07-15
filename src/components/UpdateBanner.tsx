/** Banner when a new service worker is waiting — reload to activate. */

import { useEffect, useState } from 'react'
import { getServiceWorkerManager } from '../services/serviceWorker'
import { releaseNotesBullets } from '../domain/releaseNotes'

export function UpdateBanner() {
  const [waiting, setWaiting] = useState(false)
  const notes = releaseNotesBullets(3)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg || cancelled) return
        if (reg.waiting) {
          setWaiting(true)
          return
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(true)
            }
          })
        })
      } catch {
        /* ignore */
      }
    }

    void check()
    const onVisible = () => {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        void reg?.update()
        if (reg?.waiting) setWaiting(true)
      })
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('mydsp-sw-waiting', () => setWaiting(true))
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!waiting) return null

  return (
    <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[1500] max-w-sm w-[calc(100%-2rem)] surface border border-border-strong border-l-2 border-l-accent px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold">New version ready</p>
      <p className="text-xs text-text-subtle mt-1 mb-2">
        Reload to get the latest MyDSP build on this device.
      </p>
      {notes.length > 0 ? (
        <ul className="update-banner-release-notes text-xs text-text-muted mb-3 list-disc pl-4 space-y-0.5">
          {notes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => {
            const mgr = getServiceWorkerManager()
            if (mgr) {
              void mgr.skipWaiting()
            } else {
              void navigator.serviceWorker.getRegistration().then((reg) => {
                reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
              })
              // Fallback reload if no controllerchange
              window.setTimeout(() => window.location.reload(), 800)
            }
          }}
        >
          Reload
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setWaiting(false)}>
          Later
        </button>
      </div>
    </div>
  )
}
