import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

const MENU_WIDTH = 176

function useWideMenu() {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return wide
}

/**
 * Compact actions: optional leading controls + a ⋯ menu.
 * Default: phone uses ⋯; md+ expands items inline (page headers only).
 * Pass `compact` for list rows / master-detail so text never overlaps.
 * The sheet is portaled so swipe-row overflow:hidden cannot clip it.
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const wide = useWideMenu()
  const [anchor, setAnchor] = useState<{ top: number; left: number; openUp: boolean } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null)
      return
    }
    const place = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const left = Math.min(
        Math.max(8, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8,
      )
      const estimated = Math.min(items.length * 44 + 16, window.innerHeight * 0.45)
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const openUp = spaceBelow < estimated && rect.top > spaceBelow
      setAnchor({
        top: openUp ? rect.top - 4 : rect.bottom + 4,
        left,
        openUp,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (sheetRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const menuButtons = items.map((item) => (
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
  ))

  const menuSheet =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={sheetRef}
            id={menuId}
            role="menu"
            data-testid="overflow-menu-sheet"
            className={
              wide
                ? 'overflow-menu-sheet overflow-menu-sheet--anchored'
                : 'overflow-menu-sheet fixed inset-0 z-[80] flex min-w-0 flex-col border border-border bg-bg-elevated p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] shadow-lg'
            }
            style={
              wide && anchor
                ? {
                    top: anchor.openUp ? undefined : anchor.top,
                    bottom: anchor.openUp ? window.innerHeight - anchor.top : undefined,
                    left: anchor.left,
                    width: MENU_WIDTH,
                  }
                : undefined
            }
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3 sm:hidden">
              <p className="text-xs font-bold uppercase tracking-widest text-text-subtle">
                Actions
              </p>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {menuButtons}
          </div>,
          document.body,
        )
      : null

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
          ref={triggerRef}
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
