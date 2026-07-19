import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useLayoutMode, useShowBottomNav } from '../../hooks/useShowBottomNav'
import { prefetchRouteChunk } from '../../hooks/useIdlePrefetch'
import { prefetchMarketQuotes } from '../../services/marketsQuotes'
import {
  loadBottomNavMiddleSlots,
  saveBottomNavMiddleSlots,
} from '../../storage/bottomNavSlots'
import { BOTTOM_NAV_CATALOG, resolveBottomNavItems, type BottomNavItem } from '../../domain/bottomNav'
import { dueWithinDays } from '../../domain/recurringDueStrip'
import { usePortfolio } from '../../context/PortfolioContext'
import { newsUnreadFromCache } from '../../storage/newsStore'
import { youtubeUnreadFromCache } from '../../storage/youtubeStore'
import { Modal } from '../ui/Modal'
import { ReorderHandle, ReorderList } from '../ui/Reorderable'
import { syncNow } from '../../services/sync/autoSyncService'

function readItems(): BottomNavItem[] {
  return resolveBottomNavItems(loadBottomNavMiddleSlots())
}

function readMiddleItems(): BottomNavItem[] {
  return loadBottomNavMiddleSlots()
    .map((p) => BOTTOM_NAV_CATALOG[p])
    .filter((x): x is BottomNavItem => Boolean(x))
}

function prefetchMarketsNav(): void {
  prefetchRouteChunk('/markets')
  prefetchMarketQuotes()
}

function isDigestLongPressItem(item: BottomNavItem): boolean {
  return item.to === '/' || item.label.toLowerCase() === 'today'
}

export function BottomNav() {
  const show = useShowBottomNav()
  const mode = useLayoutMode()
  const { pathname } = useLocation()
  const { data } = usePortfolio()
  const [items, setItems] = useState<BottomNavItem[]>(() => readItems())
  const [favSheetOpen, setFavSheetOpen] = useState(false)
  const [middleItems, setMiddleItems] = useState<BottomNavItem[]>(() => readMiddleItems())
  const [newsUnread, setNewsUnread] = useState(() => newsUnreadFromCache())
  const [youtubeUnread, setYoutubeUnread] = useState(() => youtubeUnreadFromCache())
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const lastOverviewTap = useRef(0)
  const billsDueSoon = useMemo(
    () => dueWithinDays(data.recurringTransactions, 7).length > 0,
    [data.recurringTransactions],
  )

  useEffect(() => {
    const refresh = () => {
      setItems(readItems())
      setMiddleItems(readMiddleItems())
    }
    window.addEventListener('mydsp-nav-order', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('mydsp-nav-order', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const refreshNewsUnread = () => setNewsUnread(newsUnreadFromCache())
    const refreshYoutubeUnread = () => setYoutubeUnread(youtubeUnreadFromCache())
    refreshNewsUnread()
    refreshYoutubeUnread()
    window.addEventListener('mydsp-news-articles', refreshNewsUnread)
    window.addEventListener('mydsp-news-changed', refreshNewsUnread)
    window.addEventListener('mydsp-youtube-videos', refreshYoutubeUnread)
    window.addEventListener('mydsp-youtube-changed', refreshYoutubeUnread)
    return () => {
      window.removeEventListener('mydsp-news-articles', refreshNewsUnread)
      window.removeEventListener('mydsp-news-changed', refreshNewsUnread)
      window.removeEventListener('mydsp-youtube-videos', refreshYoutubeUnread)
      window.removeEventListener('mydsp-youtube-changed', refreshYoutubeUnread)
    }
  }, [])

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const openFavouriteSheet = () => {
    setMiddleItems(readMiddleItems())
    setFavSheetOpen(true)
  }

  const dispatchWeeklyDigestOpen = () => {
    window.dispatchEvent(new CustomEvent('mydsp-open-weekly-digest'))
  }

  const dispatchMarketsRefresh = () => {
    window.dispatchEvent(new CustomEvent('mydsp-markets-refresh'))
  }
  const dispatchNewsRefresh = () => {
    window.dispatchEvent(new CustomEvent('mydsp-news-refresh'))
  }
  const dispatchYoutubeRefresh = () => {
    window.dispatchEvent(new CustomEvent('mydsp-youtube-refresh'))
  }

  const startLongPress = (item: BottomNavItem) => {
    longPressFired.current = false
    clearLongPress()
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      longPressTimer.current = null
      if (isDigestLongPressItem(item)) {
        dispatchWeeklyDigestOpen()
      } else if (item.to === '/markets') {
        dispatchMarketsRefresh()
      } else if (item.to === '/news') {
        dispatchNewsRefresh()
      } else if (item.to === '/youtube') {
        dispatchYoutubeRefresh()
      } else if (
        item.to === '/todos' ||
        item.to === '/jobs' ||
        item.to === '/spending' ||
        item.to === '/recurring' ||
        item.to === '/tax' ||
        item.to === '/compare' ||
        item.to === '/equities' ||
        item.to === '/crypto' ||
        item.to === '/liabilities' ||
        item.to === '/goals' ||
        item.to === '/history' ||
        item.to === '/budgets' ||
        item.to === '/import' ||
        item.to === '/family' ||
        item.to === '/documents' ||
        item.to === '/journal' ||
        item.to === '/rules' ||
        item.to === '/staking' ||
        item.to === '/planning' ||
        item.to === '/achievements' ||
        item.to === '/fire' ||
        item.to === '/optimizer' ||
        item.to === '/api' ||
        item.to === '/insights' ||
        item.to === '/review' ||
        item.to === '/trips' ||
        item.to === '/analytics' ||
        item.to === '/settings' ||
        item.to.startsWith('/settings')
      ) {
        void syncNow()
      } else {
        openFavouriteSheet()
      }
    }, 520)
  }

  const onMiddleReorder = (next: BottomNavItem[]) => {
    saveBottomNavMiddleSlots(next.map((i) => i.to))
    setMiddleItems(next)
    setItems(readItems())
  }

  const scrollTodayToTop = () => {
    const main = document.getElementById('main-content')
    main?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!show) return null

  const tablet = mode === 'tablet'

  return (
    <>
      <nav
        className={`bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-bg-elevated border-t border-border pb-[env(safe-area-inset-bottom)] ${
          tablet ? 'bottom-nav--tablet' : ''
        }`}
        aria-label={tablet ? 'Tablet navigation' : 'Mobile navigation'}
        role="navigation"
        onContextMenu={(e) => {
          e.preventDefault()
          openFavouriteSheet()
        }}
      >
        <div
          className={`flex items-center justify-around px-1 pt-1.5 ${
            tablet ? 'max-w-3xl mx-auto px-4 gap-1' : ''
          }`}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onMouseEnter={item.to === '/markets' ? prefetchMarketsNav : undefined}
              onFocus={item.to === '/markets' ? prefetchMarketsNav : undefined}
              onTouchStart={() => startLongPress(item)}
              onTouchEnd={clearLongPress}
              onTouchMove={clearLongPress}
              onTouchCancel={clearLongPress}
              onContextMenu={(e) => {
                if (!isDigestLongPressItem(item)) return
                e.preventDefault()
                e.stopPropagation()
                longPressFired.current = true
                clearLongPress()
                dispatchWeeklyDigestOpen()
              }}
              onClick={(e) => {
                if (longPressFired.current) {
                  e.preventDefault()
                  longPressFired.current = false
                  return
                }
                if (item.to === '/') {
                  const now = Date.now()
                  if (pathname === '/' && now - lastOverviewTap.current < 450) {
                    e.preventDefault()
                    scrollTodayToTop()
                  }
                  lastOverviewTap.current = now
                }
              }}
              className={({ isActive }) =>
                `bottom-nav-link relative flex flex-col items-center gap-0.5 py-2 min-h-11 transition-colors ${
                  tablet ? 'px-4 min-w-[4.5rem] flex-1' : 'px-2 min-w-[3.5rem]'
                } ${isActive ? 'text-accent bottom-nav-link--active' : 'text-text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative inline-flex">
                    <item.icon size={tablet ? 22 : 20} strokeWidth={isActive ? 2.25 : 1.75} />
                    {item.to === '/news' && newsUnread > 0 ? (
                      <span
                        className="bottom-nav-unread"
                        aria-label={`${newsUnread} unread news`}
                      />
                    ) : null}
                    {item.to === '/youtube' && youtubeUnread > 0 ? (
                      <span
                        className="bottom-nav-unread"
                        aria-label={`${youtubeUnread} unread videos`}
                      />
                    ) : null}
                    {(item.to === '/recurring' || item.to === '/spending') && billsDueSoon ? (
                      <span
                        className="bottom-nav-bills-due bottom-nav-unread"
                        aria-label="Bills due within 7 days"
                      />
                    ) : null}
                  </span>
                  <span
                    className={`bottom-nav-link-label font-semibold leading-tight tracking-tight ${
                      tablet ? 'text-xs' : 'text-[11px]'
                    }`}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <Modal open={favSheetOpen} title="Reorder middle tabs" onClose={() => setFavSheetOpen(false)}>
        <p className="text-sm text-text-muted font-light mb-4">
          Drag ⋮⋮ to reorder the three middle tabs. Overview and Settings stay fixed at each end.
        </p>
        {middleItems.length === 0 ? (
          <p className="text-sm text-text-subtle">No middle tabs yet.</p>
        ) : (
          <ReorderList
            items={middleItems}
            getId={(item) => item.to}
            onReorder={onMiddleReorder}
            className="space-y-2"
          >
            {(item) => (
              <div className="flex items-center gap-3 surface px-3 py-2.5 rounded-lg md:rounded-none">
                <ReorderHandle label={`Reorder ${item.label}`} />
                <item.icon size={18} strokeWidth={1.75} className="text-text-muted shrink-0" />
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
            )}
          </ReorderList>
        )}
        <p className="mt-4 text-xs text-text-subtle">
          <Link
            to="/settings#layout"
            className="text-accent font-semibold hover:underline"
            onClick={() => setFavSheetOpen(false)}
          >
            Open Settings → Layout
          </Link>{' '}
          to swap which sections appear in the three middle slots.
        </p>
      </Modal>
    </>
  )
}
