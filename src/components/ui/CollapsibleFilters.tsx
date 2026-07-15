/** Collapsible filter / tools panel — defaults collapsed to free vertical space. */

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
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

  const summaryText =
    summary?.trim() ||
    (activeCount > 0 ? `${activeCount} active` : 'None active')

  return (
    <div
      className={`surface mb-4 rounded-xl md:rounded-none shadow-sm md:shadow-none overflow-hidden ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          className="flex items-center gap-2 min-h-11 sm:min-h-9 flex-1 min-w-[10rem] text-left hover:text-accent transition-colors"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setUiPanelOpen(id, !open)}
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} className="shrink-0 text-text-muted" aria-hidden />
          <span className="text-sm font-semibold text-text">{title}</span>
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

      {open ? (
        <div id={`${id}-panel`} className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-border pt-3">
          {children}
        </div>
      ) : null}
    </div>
  )
}
