import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Settings, Menu, X, RefreshCw, Newspaper } from 'lucide-react'
import { usePortfolio } from '../../context/PortfolioContext'
import { BrandMark } from '../BrandMark'
import { dueWithinDays } from '../../domain/recurringDueStrip'
import { SIDEBAR_NAV } from '../../domain/primaryNav'
import { prefetchRouteChunk } from '../../hooks/useIdlePrefetch'
import { newsUnreadFromCache } from '../../storage/newsStore'
import { youtubeUnreadFromCache } from '../../storage/youtubeStore'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { pathname, hash } = useLocation()
  const { data } = usePortfolio()
  const billsDueSoon = useMemo(
    () => dueWithinDays(data.recurringTransactions, 7).length > 0,
    [data.recurringTransactions],
  )
  const syncActive = pathname === '/settings' && hash === '#sync'
  const settingsActive = pathname === '/settings' && hash !== '#sync'
  const [moneyPulse, setMoneyPulse] = useState(billsDueSoon)
  const [newsUnread, setNewsUnread] = useState(() => newsUnreadFromCache())
  const [youtubeUnread, setYoutubeUnread] = useState(() => youtubeUnreadFromCache())

  useEffect(() => {
    setMoneyPulse(billsDueSoon)
  }, [billsDueSoon])

  useEffect(() => {
    const refresh = () => {
      setNewsUnread(newsUnreadFromCache())
      setYoutubeUnread(youtubeUnreadFromCache())
    }
    window.addEventListener('mydsp-news-articles', refresh)
    window.addEventListener('mydsp-news-changed', refresh)
    window.addEventListener('mydsp-youtube-videos', refresh)
    window.addEventListener('mydsp-youtube-changed', refresh)
    refresh()
    return () => {
      window.removeEventListener('mydsp-news-articles', refresh)
      window.removeEventListener('mydsp-news-changed', refresh)
      window.removeEventListener('mydsp-youtube-videos', refresh)
      window.removeEventListener('mydsp-youtube-changed', refresh)
    }
  }, [])

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="app-sidebar-backdrop fixed inset-0 z-40 bg-bg/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        aria-label="Sidebar navigation"
        className={`
          app-sidebar
          ${open ? 'app-sidebar--open' : ''}
          fixed inset-y-0 left-0 z-50 w-[min(20rem,88%)]
          bg-bg-elevated border-r border-border
          flex flex-col
          transition-transform duration-300 ease-out
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          lg:static lg:z-auto lg:w-60 xl:w-64 lg:max-w-none lg:translate-x-0 lg:pt-0 lg:pb-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <BrandMark size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <p className="wordmark text-lg leading-none text-text">
                M<span className="text-[0.85em] font-semibold tracking-normal">y</span>DSP
              </p>
              <span className="text-[11px] font-light text-white light:text-black/50 tabular-nums shrink-0">
                v{__APP_VERSION__}
              </span>
            </div>
            <p className="label-uppercase mt-1.5 text-[11px]">Personal finance</p>
          </div>
          <button
            type="button"
            className="sidebar-close-btn lg:hidden w-11 h-11 flex items-center justify-center border border-border-strong text-text-muted hover:text-accent hover:border-accent"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-3 pt-3 pb-1 space-y-1 border-b border-border">
          <button
            type="button"
            className="nav-link nav-link-flex w-full text-left"
            onClick={() => {
              onClose()
              if (pathname === '/' || pathname.startsWith('/compare')) {
                window.dispatchEvent(new CustomEvent('mydsp-open-weekly-digest'))
                return
              }
              window.location.assign('/?digest=1')
            }}
          >
            <Newspaper size={16} strokeWidth={1.5} />
            Weekly digest
          </button>
          <NavLink
            to="/settings#sync"
            onClick={onClose}
            className={`nav-link nav-link-flex ${syncActive ? 'active' : ''}`}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
            Cloud Sync
          </NavLink>
          <NavLink
            to="/settings"
            end
            onClick={onClose}
            className={`nav-link nav-link-flex ${settingsActive ? 'active' : ''}`}
          >
            <Settings size={16} strokeWidth={1.5} />
            Settings
          </NavLink>
        </div>

        <nav className="flex-1 py-1 overflow-y-auto" role="navigation" aria-label="Primary">
          <div className="px-3 pt-3 pb-1">
            <p className="nav-section-label">Menu</p>
          </div>
          <ul className="flex flex-col nav-favourites-list">
            {SIDEBAR_NAV.map((link) => {
              const Icon = link.icon
              const unread =
                link.to === '/news' ? newsUnread : link.to === '/youtube' ? youtubeUnread : 0
              return (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    onClick={onClose}
                    onMouseEnter={() => prefetchRouteChunk(link.to)}
                    onFocus={() => prefetchRouteChunk(link.to)}
                    className={({ isActive }) => `nav-link nav-link-flex ${isActive ? 'active' : ''}`}
                  >
                    <span className="relative inline-flex shrink-0">
                      <Icon size={16} strokeWidth={1.5} />
                      {link.to === '/money' && moneyPulse ? (
                        <span
                          className="sidebar-unread sidebar-bills-due"
                          aria-label="Bills due within 7 days"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 truncate">{link.label}</span>
                    {unread > 0 ? (
                      <span
                        className="sidebar-nav-unread"
                        aria-label={`${unread} unread`}
                        data-testid={link.to === '/news' ? 'sidebar-news-unread' : 'sidebar-youtube-unread'}
                      >
                        {unread > 9 ? '9+' : unread}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <p className="text-[11px] text-text-subtle font-light">MyDSP · local-first</p>
        </div>
      </aside>
    </>
  )
}

export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      title="Menu"
      className="toolbar-icon toolbar-menu-btn lg:hidden"
    >
      <Menu size={18} strokeWidth={1.5} />
    </button>
  )
}
