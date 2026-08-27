import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useLayoutMode, useShowBottomNav } from '../../hooks/useShowBottomNav'
import { prefetchRouteChunk } from '../../hooks/useIdlePrefetch'
import { prefetchMarketQuotes } from '../../services/marketsQuotes'
import { resolveBottomNavItems, type BottomNavItem } from '../../domain/bottomNav'
import { dueWithinDays } from '../../domain/recurringDueStrip'
import { usePortfolio } from '../../context/PortfolioContext'

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
  const items = useMemo(() => resolveBottomNavItems(), [])
  const lastOverviewTap = useRef(0)
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const billsDueSoon = useMemo(
    () => dueWithinDays(data.recurringTransactions, 7).length > 0,
    [data.recurringTransactions],
  )
  const [moneyPulse, setMoneyPulse] = useState(billsDueSoon)

  useEffect(() => {
    setMoneyPulse(billsDueSoon)
  }, [billsDueSoon])

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const dispatchWeeklyDigestOpen = () => {
    window.dispatchEvent(new CustomEvent('mydsp-open-weekly-digest'))
  }

  const startLongPress = (item: BottomNavItem) => {
    longPressFired.current = false
    clearLongPress()
    if (!isDigestLongPressItem(item)) return
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      longPressTimer.current = null
      dispatchWeeklyDigestOpen()
    }, 520)
  }

  const scrollTodayToTop = () => {
    const main = document.getElementById('main-content')
    main?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!show) return null

  const tablet = mode === 'tablet'

  return (
    <nav
      className={`bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-bg-elevated border-t border-border pb-[env(safe-area-inset-bottom)] ${
        tablet ? 'bottom-nav--tablet' : ''
      }`}
      aria-label={tablet ? 'Tablet navigation' : 'Mobile navigation'}
      role="navigation"
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
                  {item.to === '/money' && moneyPulse ? (
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
  )
}
