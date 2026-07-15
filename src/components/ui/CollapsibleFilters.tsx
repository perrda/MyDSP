/** Collapsible filter / tools panel — defaults collapsed to free vertical space.
 *  On phone (<640px) opens as a bottom sheet instead of inline expand.
 */

import { useEffect, useId, useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { isUiPanelOpen, setUiPanelOpen, subscribeUiPanels } from '../../storage/uiPanelsStore'

type Props = {
  /** Persistence key (e.g. `todos-filters`) */
  id: string
  /** Header label when collapsed/expanded */
  title?: string
  /** Short active-filter summary shown next to the title when collapsed */
  summary?: string
  /** Count of active filters — shown as a badge when collapsed */
  activeCount?: number
  /** Always-visible actions on the header row (Import / Export, etc.) */
  actions?: ReactNode
  children: ReactNode
  className?: string
}

function useIsPhoneFilters(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return narrow
}

export function CollapsibleFilters({
  id,
  title = 'Filters',
  summary,
  activeCount = 0,
  actions,
  children,
  className = '',
}: Props) {
  const [, bump] = useState(0)
  useEffect(() => subscribeUiPanels(() => bump((n) => n + 1)), [])
  const open = isUiPanelOpen(id)
  const isPhone = useIsPhoneFilters()
  const titleId = useId()
  const sheetTitle = title.includes('Filters') ? title : `Filters · ${title}`

  const summaryText =
    summary?.trim() ||
    (activeCount > 0 ? `${activeCount} active` : 'None active')

  useEffect(() => {
    if (!open || !isPhone) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUiPanelOpen(id, false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, isPhone, id])

  const toggle = () => setUiPanelOpen(id, !open)

  return (
    <div
      className={`surface mb-4 rounded-xl md:rounded-none shadow-sm md:shadow-none overflow-hidden ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          className="flex items-center gap-2 min-h-11 sm:min-h-9 flex-1 min-w-[10rem] text-left hover:text-accent transition-colors"
          aria-expanded={open}
          aria-controls={isPhone && open ? `${id}-sheet` : `${id}-panel`}
          aria-haspopup={isPhone ? 'dialog' : undefined}
          onClick={toggle}
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} className="shrink-0 text-text-muted" aria-hidden />
          <span className="text-sm font-semibold text-text">{isPhone ? 'Filters' : title}</span>
          {!open && (
            <span className="text-xs text-text-subtle font-light truncate max-w-[14rem] sm:max-w-[22rem]">
              · {summaryText}
            </span>
          )}
          {activeCount > 0 && !open ? (
            <span className="shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 bg-accent/15 text-accent border border-accent/30">
              {activeCount}
            </span>
          ) : null}
          <span
            className="shrink-0 w-8 h-8 flex items-center justify-center border border-border text-text-muted ml-auto sm:ml-1"
            aria-hidden
          >
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
            {actions}
          </div>
        ) : null}
      </div>

      {/* Desktop / tablet: inline expand */}
      {open && !isPhone ? (
        <div id={`${id}-panel`} className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-border pt-3">
          {children}
        </div>
      ) : null}

      {/* Phone: Filters sheet */}
      {open && isPhone ? (
        <div className="filters-sheet-root fixed inset-0 z-[60]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close filters"
            onClick={() => setUiPanelOpen(id, false)}
          />
          <div
            id={`${id}-sheet`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="filters-sheet modal-enter absolute left-0 right-0 bottom-0 max-h-[min(85dvh,36rem)] overflow-y-auto bg-bg-elevated border-t border-border rounded-t-2xl shadow-lg"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-bg-elevated pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <h2 id={titleId} className="text-base font-bold tracking-tight">
                {sheetTitle}
              </h2>
              <button
                type="button"
                className="btn-ghost btn-sm p-2 min-h-11 min-w-11"
                aria-label="Close filters"
                onClick={() => setUiPanelOpen(id, false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
              {children}
              <button
                type="button"
                className="btn-primary w-full min-h-11"
                onClick={() => setUiPanelOpen(id, false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
