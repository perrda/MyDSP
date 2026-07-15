import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

export type OverflowMenuItem = {
  id: string
  label: string
  onClick: () => void
  destructive?: boolean
  active?: boolean
}

interface OverflowMenuProps {
  label: string
  items: OverflowMenuItem[]
  /** Extra content shown beside the trigger (e.g. primary Buy/Sell). */
  leading?: ReactNode
  className?: string
}

/**
 * Compact actions for phone: primary leading controls + a ⋯ menu.
 * On md+ the menu items render inline next to leading (caller can also
 * pass `inlineOnDesktop` via className on a parent).
 */
export function OverflowMenu({ label, items, leading, className = '' }: OverflowMenuProps) {
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
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className={`relative flex flex-wrap items-center gap-2 ${className}`}>
      {leading}

      {/* Desktop / tablet: full inline secondary actions */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              item.destructive
                ? 'btn-ghost btn-sm min-h-9 text-red-500'
                : item.active
                  ? 'text-[11px] font-bold uppercase tracking-widest px-2 py-1 border min-h-9 border-accent text-accent'
                  : item.id === 'nw'
                    ? 'text-[11px] font-bold uppercase tracking-widest px-2 py-1 border min-h-9 border-border-strong text-text-subtle'
                    : 'btn-ghost btn-sm min-h-9'
            }
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Phone: overflow trigger */}
      <div className="md:hidden relative">
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
        {open ? (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 top-full mt-1 z-30 min-w-[10.5rem] border border-border bg-bg-elevated shadow-lg py-1"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`w-full text-left px-4 py-2.5 text-sm min-h-11 transition-colors hover:bg-surface-hover ${
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
        ) : null}
      </div>
    </div>
  )
}
