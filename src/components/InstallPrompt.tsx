import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LAST_BACKUP_KEY } from '../storage/backupStore'
import { loadOfflineQueue } from '../services/offlineQueue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'mydsp_a2hs_dismissed'

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)) ||
    window.matchMedia('(display-mode: standalone)').matches
  return iOS && !standalone
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosHint, setIosHint] = useState(false)
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [queueLen, setQueueLen] = useState(() => loadOfflineQueue().length)
  const [lastBackupDay, setLastBackupDay] = useState<string | null>(() => {
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

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    if (isIosSafari()) {
      setIosHint(true)
      setVisible(true)
      return
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
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-[1400] max-w-sm surface border border-border-strong border-l-2 border-l-accent px-4 py-3">
        <p className="text-sm font-semibold">Offline</p>
        <p className="text-xs text-text-subtle mt-1 leading-relaxed">
          Cached shell available. Live prices need a connection.
          {queueLen > 0
            ? ` ${queueLen} edit(s) queued — they sync when you are back online.`
            : ' Edits will queue automatically.'}
        </p>
        {lastBackupDay ? (
          <p className="text-[11px] text-text-subtle mt-2">Last local backup day: {lastBackupDay}</p>
        ) : null}
        <Link to="/settings#sync" className="text-xs text-accent font-semibold mt-2 inline-block">
          Sync & backups
        </Link>
      </div>
    )
  }

  if (!visible) return null
  if (!iosHint && !deferred) return null

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] sm:right-auto z-[1400] max-w-sm surface border border-border-strong border-l-2 border-l-accent px-4 py-3">
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
            className="btn-primary btn-sm"
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
          className="btn-ghost btn-sm"
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
