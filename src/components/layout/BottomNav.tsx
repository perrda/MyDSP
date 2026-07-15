import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useLayoutMode, useShowBottomNav } from '../../hooks/useShowBottomNav'
import { loadNavLayout } from '../../storage/navOrder'
import { BOTTOM_NAV_CATALOG, resolveBottomNavItems, type BottomNavItem } from '../../domain/bottomNav'

function readItems(): BottomNavItem[] {
  const layout = loadNavLayout(Object.keys(BOTTOM_NAV_CATALOG))
  return resolveBottomNavItems(layout.favourites)
}

export function BottomNav() {
  const show = useShowBottomNav()
  const mode = useLayoutMode()
  const [items, setItems] = useState<BottomNavItem[]>(() => readItems())

  useEffect(() => {
    const refresh = () => setItems(readItems())
    window.addEventListener('mydsp-nav-order', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('mydsp-nav-order', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  if (!show) return null

  const tablet = mode === 'tablet'

  return (
    <nav
      className={`bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-bg-elevated border-t border-border pb-[env(safe-area-inset-bottom)] ${
        tablet ? 'bottom-nav--tablet' : ''
      }`}
      aria-label={tablet ? 'Tablet navigation' : 'Mobile navigation'}
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
                  className={`font-semibold leading-tight tracking-tight ${
                    tablet ? 'text-xs' : 'text-[11px]'
                  }`}
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
