import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

export type OverflowMenuItem = {
  id: string
  label: string
  onClick: () => void
  destructive?: boolean
  active?: boolean
  disabled?: boolean
}

interface OverflowMenuProps {
  label: string
  items: OverflowMenuItem[]
  /** Extra content shown beside the trigger (e.g. primary Buy/Sell). */
  leading?: ReactNode
  /**
   * Always use the ⋯ menu (never expand items inline on md+).
   * Required for dense list/master-detail rows — inline actions crush
   * identity/metrics text and cause overlap.
   */
  compact?: boolean
  className?: string
}

/**
 * Compact actions: optional leading controls + a ⋯ menu.
 * Default: phone uses ⋯; md+ expands items inline (page headers only).
 * Pass `compact` for list rows / master-detail so text never overlaps.
 */
export function OverflowMenu({
  label,
  items,
  leading,
  compact = false,
  className = '',
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    // Phone full-screen sheet: prevent background scroll
    const isPhoneSheet =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
    const prevOverflow = document.body.style.overflow
    if (isPhoneSheet) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
      if (isPhoneSheet) document.body.style.overflow = prevOverflow
    }
  }, [open])

  const menuSheet =
    open ? (
      <div
        id={menuId}
        role="menu"
        className="overflow-menu-sheet fixed inset-0 z-50 flex min-w-0 flex-col border border-border bg-bg-elevated p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] shadow-lg sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1 sm:block sm:min-w-[10.5rem] sm:p-0 sm:py-1"
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3 sm:hidden">
          <p className="text-xs font-bold uppercase tracking-widest text-text-subtle">
            Actions
          </p>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`w-full text-left px-4 py-3 text-base min-h-12 transition-colors hover:bg-surface-hover sm:py-2.5 sm:text-sm sm:min-h-11 disabled:opacity-45 disabled:pointer-events-none ${
              item.destructive
                ? 'text-red-500'
                : item.active
                  ? 'text-accent font-semibold'
                  : 'text-text'
            }`}
            onClick={() => {
              setOpen(false)
              item.onClick()
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    ) : null

  return (
    <div
      ref={wrapRef}
      className={`relative flex flex-wrap items-center gap-2 ${className}`}
      data-overflow-compact={compact ? 'true' : undefined}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {leading}

      {/* Desktop / tablet: full inline secondary actions (headers only — not list rows) */}
      {!compact ? (
        <div className="hidden md:flex flex-wrap items-center gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              className={
                item.destructive
                  ? 'btn-ghost btn-sm min-h-9 text-red-500 disabled:opacity-45'
                  : item.active
                    ? 'text-[11px] font-bold uppercase tracking-widest px-2 py-1 border min-h-9 border-accent text-accent disabled:opacity-45'
                    : item.id === 'nw'
                      ? 'text-[11px] font-bold uppercase tracking-widest px-2 py-1 border min-h-9 border-border-strong text-text-subtle disabled:opacity-45'
                      : 'btn-ghost btn-sm min-h-9 disabled:opacity-45'
              }
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Phone (always) or compact (all breakpoints): overflow trigger */}
      <div className={compact ? 'relative' : 'md:hidden relative'}>
        <button
          type="button"
          className="btn-ghost btn-sm min-h-11 min-w-11 p-2"
          aria-label={label}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <MoreHorizontal size={18} strokeWidth={2} />
        </button>
        {menuSheet}
      </div>
    </div>
  )
}
