import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AchievementDef } from '../domain/achievements'

interface ToastItem {
  id: string
  achievement: AchievementDef
}

interface ToastContextValue {
  pushAchievements: (items: AchievementDef[]) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushAchievements = useCallback((items: AchievementDef[]) => {
    if (!items.length) return
    setToasts((prev) => [
      ...prev,
      ...items.map((a) => ({ id: `${a.id}-${Date.now()}-${Math.random()}`, achievement: a })),
    ])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({ pushAchievements }), [pushAchievements])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[1500] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="surface border border-border-strong border-l-2 border-l-accent px-4 py-3 shadow-lg"
            role="status"
          >
            <div className="flex gap-3 items-start">
              <span className="text-xl" aria-hidden>
                {t.achievement.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">
                  Achievement unlocked
                </p>
                <p className="font-bold tracking-tight">{t.achievement.name}</p>
                <p className="text-sm text-text-muted font-light">{t.achievement.desc}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-subtle mt-2">
                  +{t.achievement.xp} XP ·{' '}
                  <Link to="/achievements" className="text-accent hover:underline">
                    View all
                  </Link>
                </p>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => dismiss(t.id)}>
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
