import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  isSettingsSectionOpen,
  setSettingsSectionOpen,
  subscribeSettingsSections,
} from '../storage/settingsSectionsStore'

type Props = {
  id: string
  eyebrow: string
  title: string
  children: ReactNode
  className?: string
}

/**
 * Collapsible Settings block. Click the orange eyebrow (or whole header) to expand/collapse.
 * Defaults collapsed so every section name is visible without scrolling through all content.
 */
export function SettingsSection({ id, eyebrow, title, children, className = '' }: Props) {
  const [, bump] = useState(0)
  useEffect(() => subscribeSettingsSections(() => bump((n) => n + 1)), [])
  const open = isSettingsSectionOpen(id)

  return (
    <section
      id={id}
      className={`surface scroll-mt-24 ${className}`.trim()}
    >
      <button
        type="button"
        className="w-full flex items-start justify-between gap-3 text-left p-4 sm:p-6 md:p-8 hover:bg-surface-hover/50 transition-colors"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setSettingsSectionOpen(id, !open)}
      >
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{eyebrow}</p>
          <h3 className="text-lg font-bold tracking-tight text-text">{title}</h3>
        </div>
        <span
          className="shrink-0 mt-1 w-9 h-9 flex items-center justify-center border border-border-strong text-text-muted"
          aria-hidden
        >
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {open && (
        <div id={`${id}-panel`} className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 -mt-2">
          {children}
        </div>
      )}
    </section>
  )
}
