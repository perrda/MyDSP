import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AchievementDef } from '../domain/achievements'
import type { Toast } from './ui/Toast'
import { ToastItem } from './ui/Toast'

interface ToastAchievement {
  id: string
  achievement: AchievementDef
}

interface ToastContextValue {
  pushAchievements: (items: AchievementDef[]) => void
  showToast: (toast: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [achievementToasts, setAchievementToasts] = useState<ToastAchievement[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushAchievements = useCallback((items: AchievementDef[]) => {
    if (!items.length) return
    setAchievementToasts((prev) => [
      ...prev,
      ...items.map((a) => ({ id: `${a.id}-${Date.now()}-${Math.random()}`, achievement: a })),
    ])
  }, [])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const success = useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast],
  )

  const error = useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message }),
    [showToast],
  )

  const warning = useCallback(
    (title: string, message?: string) => showToast({ type: 'warning', title, message }),
    [showToast],
  )

  const info = useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast],
  )

  const dismissAchievement = useCallback((id: string) => {
    setAchievementToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(
    () => ({ pushAchievements, showToast, success, error, warning, info }),
    [pushAchievements, showToast, success, error, warning, info],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[1500] flex flex-col gap-3 max-w-sm w-[calc(100%-2rem)]"
        aria-live="polite"
      >
        {/* Regular toasts */}
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
        ))}

        {/* Achievement toasts */}
        {achievementToasts.map((t) => (
          <div
            key={t.id}
            className="surface border border-border-strong border-l-4 border-l-accent px-4 py-3 shadow-lg rounded-r-lg md:rounded-none animate-slide-in-right"
            role="status"
          >
            <div className="flex gap-3 items-start">
              <span className="text-2xl" aria-hidden>
                {t.achievement.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">
                  Achievement unlocked
                </p>
                <p className="font-bold tracking-tight text-sm">{t.achievement.name}</p>
                <p className="text-xs text-text-muted font-light leading-relaxed mt-0.5">
                  {t.achievement.desc}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-subtle mt-2">
                  +{t.achievement.xp} XP ·{' '}
                  <Link to="/achievements" className="text-accent hover:underline">
                    View all
                  </Link>
                </p>
              </div>
              <button
                type="button"
                className="text-text-subtle hover:text-text transition-colors flex-shrink-0 min-h-[44px] md:min-h-0 -mr-2 -mt-1 p-2"
                onClick={() => dismissAchievement(t.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToasts() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToasts requires ToastProvider')
  return ctx
}
