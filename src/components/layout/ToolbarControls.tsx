import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Ellipsis, RefreshCw } from 'lucide-react'
import { PrivacyToggle } from '../PrivacyToggle'
import { ThemeToggle } from '../ThemeToggle'
import { GlassToggle } from '../GlassToggle'
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

type ToolbarTier = 'phone' | 'tablet' | 'desktop'

function readTier(): ToolbarTier {
  if (typeof window === 'undefined') return 'phone'
  if (window.matchMedia('(min-width: 1024px)').matches) return 'desktop'
  if (window.matchMedia('(min-width: 768px)').matches) return 'tablet'
  return 'phone'
}

/**
 * Workspace controls — phone / tablet / desktop tiers.
 *
 * Phone (&lt;768): Portfolio · Currency · Bell · More (Refresh · Privacy · Theme · Glass · Search)
 * Tablet (768–1023): Portfolio · Currency · Refresh · Bell · More (Privacy · Theme · Glass · Search)
 * Desktop (≥1024): full strip one-tap
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
  const [tier, setTier] = useState<ToolbarTier>(readTier)
  const menuId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mqDesktop = window.matchMedia('(min-width: 1024px)')
    const mqTablet = window.matchMedia('(min-width: 768px)')
    const sync = () => {
      const next = readTier()
      setTier(next)
      if (next === 'desktop') setMoreOpen(false)
    }
    sync()
    mqDesktop.addEventListener('change', sync)
    mqTablet.addEventListener('change', sync)
    return () => {
      mqDesktop.removeEventListener('change', sync)
      mqTablet.removeEventListener('change', sync)
    }
  }, [])

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

  const refreshBtn = (opts?: { inMenu?: boolean }) => (
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
      role={opts?.inMenu ? 'menuitem' : undefined}
    >
      <RefreshCw size={16} strokeWidth={1.5} className={refreshing ? 'animate-spin' : ''} />
    </button>
  )

  const moreMenu = (hint: string, includeRefresh: boolean) =>
    moreOpen ? (
      <div id={menuId} role="menu" aria-label="Workspace actions" className="toolbar-more-menu">
        <div className="toolbar-more-row" role="none">
          {includeRefresh ? refreshBtn({ inMenu: true }) : null}
          <PrivacyToggle privacy={privacy} onToggle={onPrivacyToggle} />
          <ThemeToggle />
          <GlassToggle />
          <GlobalSearch />
        </div>
        <p className="toolbar-more-hint">{hint}</p>
      </div>
    ) : null

  const moreTrigger = (
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
  )

  return (
    <div className="toolbar-cluster" role="toolbar" aria-label="Workspace controls" ref={wrapRef}>
      {portfolioSelect}
      {currencySelect}

      {tier === 'desktop' ? (
        <div className="toolbar-actions-desktop is-active-tier">
          {refreshBtn()}
          <NotificationCenter />
          <PrivacyToggle privacy={privacy} onToggle={onPrivacyToggle} />
          <ThemeToggle />
          <GlassToggle />
          <GlobalSearch />
        </div>
      ) : null}

      {tier === 'tablet' ? (
        <div className="toolbar-actions-tablet is-active-tier">
          {refreshBtn()}
          <NotificationCenter />
          <div className="toolbar-more-wrap">
            {moreTrigger}
            {moreMenu('Privacy · Theme · Glass · Search', false)}
          </div>
        </div>
      ) : null}

      {tier === 'phone' ? (
        <div className="toolbar-actions-mobile is-active-tier">
          <NotificationCenter />
          <div className="toolbar-more-wrap">
            {moreTrigger}
            {moreMenu('Refresh · Privacy · Theme · Glass · Search', true)}
          </div>
        </div>
      ) : null}
    </div>
  )
}
