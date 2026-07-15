import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Ellipsis, RefreshCw } from 'lucide-react'
import { PrivacyToggle } from '../PrivacyToggle'
import { ThemeToggle } from '../ThemeToggle'
import { GlobalSearch } from '../GlobalSearch'
import { NotificationCenter } from '../SmartNotifications'

interface ToolbarControlsProps {
  portfolioSelect: ReactNode
  currencySelect: ReactNode
  refreshing: boolean
  onRefresh: () => void
  privacy: boolean
  onPrivacyToggle: () => void
}

/**
 * Workspace controls: portfolio + currency always visible.
 * Refresh stays one tap away on all breakpoints; Privacy / Theme / Search
 * collapse into More (⋯) on phone/tablet.
 */
export function ToolbarControls({
  portfolioSelect,
  currencySelect,
  refreshing,
  onRefresh,
  privacy,
  onPrivacyToggle,
}: ToolbarControlsProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const menuId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (mq.matches) setMoreOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const refreshBtn = (
    <button
      type="button"
      onClick={() => {
        onRefresh()
        setMoreOpen(false)
      }}
      disabled={refreshing}
      className="toolbar-icon"
      title="Refresh all live data"
      aria-label={refreshing ? 'Refreshing data' : 'Refresh all data'}
    >
      <RefreshCw size={16} strokeWidth={1.5} className={refreshing ? 'animate-spin' : ''} />
    </button>
  )

  return (
    <div className="toolbar-cluster" role="toolbar" aria-label="Workspace controls" ref={wrapRef}>
      {portfolioSelect}
      {currencySelect}

      {/* Always visible — one-tap refresh + notifications on phone too */}
      {refreshBtn}
      <NotificationCenter />

      <div className="toolbar-actions-desktop">
        <PrivacyToggle privacy={privacy} onToggle={onPrivacyToggle} />
        <ThemeToggle />
        <GlobalSearch />
      </div>

      <div className="toolbar-actions-mobile relative">
        <button
          type="button"
          className={`toolbar-icon ${moreOpen ? 'is-active' : ''}`}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          aria-controls={menuId}
          aria-label={moreOpen ? 'Close workspace menu' : 'More workspace controls'}
          title="More"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Ellipsis size={18} strokeWidth={1.5} />
        </button>

        {moreOpen ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Workspace actions"
            className="toolbar-more-menu"
          >
            <div className="toolbar-more-row" role="none">
              <PrivacyToggle privacy={privacy} onToggle={onPrivacyToggle} />
              <ThemeToggle />
              <GlobalSearch />
            </div>
            <p className="toolbar-more-hint">Privacy · Theme · Search</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
