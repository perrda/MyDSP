import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
}

const STYLES = {
  success: 'border-l-green-500 bg-green-950/10',
  error: 'border-l-red-500 bg-red-950/10',
  warning: 'border-l-amber-500 bg-amber-950/10',
  info: 'border-l-accent bg-accent/5',
}

const ICON_COLORS = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-accent',
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false)
  const Icon = ICONS[toast.type]

  useEffect(() => {
    const duration = toast.duration ?? 5000
    if (duration === Infinity) return

    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  return (
    <div
      className={`surface border border-border-strong border-l-4 p-4 shadow-lg transition-all duration-300 rounded-r-lg md:rounded-none ${
        STYLES[toast.type]
      } ${
        isExiting
          ? 'opacity-0 translate-x-full'
          : 'opacity-100 translate-x-0 animate-slide-in-right'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3 items-start">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_COLORS[toast.type]}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm mb-0.5">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-text-muted leading-relaxed">{toast.message}</p>
          )}
          {toast.action && (
            <button
              type="button"
              className="text-xs text-accent hover:text-accent-bright font-semibold mt-2 uppercase tracking-wide"
              onClick={() => {
                toast.action?.onClick()
                handleDismiss()
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          className="text-text-subtle hover:text-text transition-colors flex-shrink-0 min-h-[44px] md:min-h-0 -mr-2 -mt-1 p-2"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
