import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
}

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-xs text-text-subtle mb-1">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-text-subtle font-light">{hint}</span>}
    </label>
  )
}

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Full-viewport sheet (mobile + desktop) — better for long forms. */
  size?: 'default' | 'full'
}

export function Modal({ open, title, onClose, children, size = 'default' }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Auto-focus once when opening — never re-run on parent re-renders (that steals caret).
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const t = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const field = panel.querySelector<HTMLElement>('input, textarea, select')
      ;(field ?? panel.querySelector<HTMLElement>('button'))?.focus()
    }, 0)

    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  const panelClass =
    size === 'full'
      ? 'modal modal-enter modal-full relative z-10 w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[min(92vh,56rem)] sm:max-w-3xl overflow-y-auto border border-border-strong'
      : 'modal modal-enter relative z-10 w-full sm:max-w-lg max-h-[min(92dvh,90vh)] overflow-y-auto border border-border-strong'

  return (
    <div
      className={`fixed inset-0 z-[1000] flex justify-center ${
        size === 'full' ? 'items-stretch sm:items-center sm:p-6' : 'items-end sm:items-center p-0 sm:p-6'
      }`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={panelClass}
      >
        <div className="sticky top-0 z-10 modal-sticky-header flex items-center justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-bg-elevated pt-[max(1rem,env(safe-area-inset-top))]">
          <h2 id={titleId} className="text-base sm:text-lg font-bold tracking-tight truncate">
            {title}
          </h2>
          <button type="button" className="btn-ghost btn-sm shrink-0 min-h-11 min-w-11" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  /** Use for destructive actions (delete, clear, overwrite). */
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  variant = 'danger',
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-text-muted mb-6">{body}</p>
      <div className="flex gap-3 pt-4 border-t border-border">
        <button type="button" className="btn-ghost flex-1 min-h-11" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={
            variant === 'danger'
              ? 'flex-1 min-h-11 px-4 py-2.5 rounded text-sm font-semibold bg-red-600 hover:bg-red-500 text-white'
              : 'btn-primary flex-1 min-h-11'
          }
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function useFormState<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial)
  const set = (key: keyof T, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }))
  const reset = (next?: T) => setValues(next ?? initial)
  return { values, set, reset, setValues }
}

export function parseNum(v: string): number {
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export type FormSubmit = (e: FormEvent) => void
