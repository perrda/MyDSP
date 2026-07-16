import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useLayoutMode, useShowBottomNav } from '../../hooks/useShowBottomNav'
import { prefetchRouteChunk } from '../../hooks/useIdlePrefetch'
import { prefetchMarketQuotes } from '../../services/marketsQuotes'
import {
  loadBottomNavMiddleSlots,
  saveBottomNavMiddleSlots,
} from '../../storage/bottomNavSlots'
import { BOTTOM_NAV_CATALOG, resolveBottomNavItems, type BottomNavItem } from '../../domain/bottomNav'
import { Modal } from '../ui/Modal'
import { ReorderHandle, ReorderList } from '../ui/Reorderable'

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

export function BottomNav() {
  const show = useShowBottomNav()
  const mode = useLayoutMode()
  const [items, setItems] = useState<BottomNavItem[]>(() => readItems())
  const [favSheetOpen, setFavSheetOpen] = useState(false)
  const [middleItems, setMiddleItems] = useState<BottomNavItem[]>(() => readMiddleItems())
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)

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

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startLongPress = () => {
    longPressFired.current = false
    clearLongPress()
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      longPressTimer.current = null
      setMiddleItems(readMiddleItems())
      setFavSheetOpen(true)
    }, 520)
  }

  const onMiddleReorder = (next: BottomNavItem[]) => {
    saveBottomNavMiddleSlots(next.map((i) => i.to))
    setMiddleItems(next)
    setItems(readItems())
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
        onTouchStart={startLongPress}
        onTouchEnd={clearLongPress}
        onTouchMove={clearLongPress}
        onTouchCancel={clearLongPress}
        onContextMenu={(e) => {
          e.preventDefault()
          setMiddleItems(readMiddleItems())
          setFavSheetOpen(true)
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
              onClick={(e) => {
                if (longPressFired.current) {
                  e.preventDefault()
                  longPressFired.current = false
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
                  <item.icon size={tablet ? 22 : 20} strokeWidth={isActive ? 2.25 : 1.75} />
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
