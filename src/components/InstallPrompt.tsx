import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LAST_BACKUP_KEY } from '../storage/backupStore'
import { loadOfflineQueue } from '../services/offlineQueue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'mydsp_a2hs_dismissed'
const SYNC_COACH_KEY = 'mydsp_a2hs_after_sync'

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)) ||
    window.matchMedia('(display-mode: standalone)').matches
  return iOS && !standalone
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosHint, setIosHint] = useState(false)
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [queueLen, setQueueLen] = useState(() => loadOfflineQueue().length)
  const [lastBackupDay] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_BACKUP_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    const onQueue = () => setQueueLen(loadOfflineQueue().length)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('mydsp-offline-queue', onQueue)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('mydsp-offline-queue', onQueue)
    }
  }, [])

  // Show A2HS after first successful sync (once), unless already dismissed / installed
  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1' || isStandalone()) return
    const onSynced = () => {
      try {
        if (localStorage.getItem(SYNC_COACH_KEY) === '1') return
        localStorage.setItem(SYNC_COACH_KEY, '1')
      } catch {
        /* private mode */
      }
      if (isIosSafari()) {
        setIosHint(true)
        setVisible(true)
      } else if (deferred) {
        setVisible(true)
      } else {
        // Still show iOS-style hint text as soft coach on browsers without BIP
        setIosHint(isIosSafari())
        setVisible(true)
      }
    }
    window.addEventListener('mydsp-sync-applied', onSynced)
    return () => window.removeEventListener('mydsp-sync-applied', onSynced)
  }, [deferred])

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    if (isIosSafari()) {
      // Defer default iOS hint until sync coach or user never synced —
      // still show if they have not dismissed and no sync coach yet after idle.
      const t = window.setTimeout(() => {
        if (localStorage.getItem(SYNC_COACH_KEY) === '1') return
        if (localStorage.getItem(DISMISS_KEY) === '1') return
        setIosHint(true)
        setVisible(true)
      }, 12_000)
      return () => window.clearTimeout(t)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (offline) {
    return (
      <div className="floating-banner fixed left-[max(1rem,env(safe-area-inset-left))] z-[1400] max-w-sm surface border border-border-strong border-l-2 border-l-accent px-4 py-3">
        <p className="text-sm font-semibold">Offline</p>
        <p className="text-xs text-text-subtle mt-1 leading-relaxed md:hidden">
          Cached shell OK.
          {queueLen > 0 ? ` ${queueLen} queued.` : ' Edits queue automatically.'}
        </p>
        <p className="text-xs text-text-subtle mt-1 leading-relaxed hidden md:block">
          Cached shell available. Live prices need a connection.
          {queueLen > 0
            ? ` ${queueLen} edit(s) queued — they sync when you are back online.`
            : ' Edits will queue automatically.'}
        </p>
        {lastBackupDay ? (
          <p className="text-[11px] text-text-subtle mt-2 hidden md:block">
            Last local backup day: {lastBackupDay}
          </p>
        ) : null}
        <Link to="/settings#sync" className="text-xs text-accent font-semibold mt-2 inline-block">
          Sync & backups
        </Link>
      </div>
    )
  }

  if (queueLen > 0) {
    return (
      <div className="floating-banner fixed left-[max(1rem,env(safe-area-inset-left))] z-[1400] max-w-sm surface border border-border-strong border-l-2 border-l-accent px-4 py-3">
        <p className="text-sm font-semibold">
          {queueLen} change{queueLen === 1 ? '' : 's'} waiting to sync
        </p>
        <p className="text-xs text-text-subtle mt-1 leading-relaxed md:hidden">
          Open Sync to flush the queue.
        </p>
        <p className="text-xs text-text-subtle mt-1 leading-relaxed hidden md:block">
          Open Sync to flush the offline queue or tap Sync now after reconnecting.
        </p>
        <Link to="/settings#sync" className="text-xs text-accent font-semibold mt-2 inline-block">
          Review queue →
        </Link>
      </div>
    )
  }

  if (!visible) return null
  if (!iosHint && !deferred) return null

  return (
    <div className="floating-banner fixed left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] sm:right-auto z-[1400] max-w-sm surface border border-border-strong border-l-2 border-l-accent px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-accent mb-1">Install</p>
      <p className="text-sm font-semibold mb-1">Add MyDSP to your home screen</p>
      {iosHint ? (
        <p className="text-xs text-text-subtle mb-3 leading-relaxed">
          In Safari: tap <span className="text-text font-semibold">Share</span> →{' '}
          <span className="text-text font-semibold">Add to Home Screen</span>. Opens full-screen like
          an app. Use Settings → Sync to keep data aligned across devices.
        </p>
      ) : (
        <p className="text-xs text-text-subtle mb-3">
          Install as an app. Local data stays on-device; sync via Settings for iPhone / iPad / web.
        </p>
      )}
      <div className="flex gap-2">
        {!iosHint && deferred && (
          <button
            type="button"
            className="btn-primary btn-sm min-h-11"
            onClick={() => {
              void (async () => {
                await deferred.prompt()
                await deferred.userChoice
                setVisible(false)
                setDeferred(null)
              })()
            }}
          >
            Install
          </button>
        )}
        <button
          type="button"
          className="btn-ghost btn-sm min-h-11"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1')
            setVisible(false)
          }}
        >
          {iosHint ? 'Got it' : 'Not now'}
        </button>
      </div>
    </div>
  )
}
