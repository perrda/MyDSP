import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { LockScreen } from './LockScreen'
import { loadSecurity } from '../security/pin'

interface SecurityContextValue {
  locked: boolean
  lock: () => void
  unlock: () => void
  bumpActivity: () => void
  refreshSecurity: () => void
  pinEnabled: boolean
}

const SecurityContext = createContext<SecurityContextValue | undefined>(undefined)

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [security, setSecurity] = useState(loadSecurity)
  const [locked, setLocked] = useState(() => loadSecurity().pinEnabled)
  const [lastActivity, setLastActivity] = useState(() => Date.now())

  const refreshSecurity = useCallback(() => {
    const next = loadSecurity()
    setSecurity(next)
    if (!next.pinEnabled) setLocked(false)
  }, [])

  const bumpActivity = useCallback(() => setLastActivity(Date.now()), [])

  const lock = useCallback(() => {
    if (loadSecurity().pinEnabled) setLocked(true)
  }, [])

  const unlock = useCallback(() => {
    setLocked(false)
    setLastActivity(Date.now())
  }, [])

  useEffect(() => {
    const onActivity = () => bumpActivity()
    const events = ['pointerdown', 'keydown', 'touchstart', 'mousemove'] as const
    for (const e of events) window.addEventListener(e, onActivity, { passive: true })
    return () => {
      for (const e of events) window.removeEventListener(e, onActivity)
    }
  }, [bumpActivity])

  useEffect(() => {
    if (!security.pinEnabled || locked) return
    const minutes = security.autoLockMinutes
    if (!minutes || minutes <= 0) return
    const id = window.setInterval(() => {
      const idle = Date.now() - lastActivity
      if (idle >= minutes * 60_000) setLocked(true)
    }, 5000)
    return () => window.clearInterval(id)
  }, [security.pinEnabled, security.autoLockMinutes, locked, lastActivity])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && loadSecurity().pinEnabled) {
        // soft lock on hide only if auto-lock is enabled
        const s = loadSecurity()
        if (s.autoLockMinutes > 0) setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const value = useMemo(
    () => ({
      locked,
      lock,
      unlock,
      bumpActivity,
      refreshSecurity,
      pinEnabled: security.pinEnabled,
    }),
    [locked, lock, unlock, bumpActivity, refreshSecurity, security.pinEnabled],
  )

  return (
    <SecurityContext.Provider value={value}>
      {children}
      {locked && security.pinEnabled ? <LockScreen onUnlock={unlock} /> : null}
    </SecurityContext.Provider>
  )
}

export function useSecurity() {
  const ctx = useContext(SecurityContext)
  if (!ctx) throw new Error('useSecurity requires SecurityProvider')
  return ctx
}
