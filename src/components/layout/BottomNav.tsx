import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useShowBottomNav } from '../../hooks/useShowBottomNav'
import { loadNavLayout } from '../../storage/navOrder'
import { BOTTOM_NAV_CATALOG, resolveBottomNavItems, type BottomNavItem } from '../../domain/bottomNav'

function readItems(): BottomNavItem[] {
  const layout = loadNavLayout(Object.keys(BOTTOM_NAV_CATALOG))
  return resolveBottomNavItems(layout.favourites)
}

export function BottomNav() {
  const show = useShowBottomNav()
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

  return (
    <nav
      className="bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-bg-elevated border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1 pt-1.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-2 min-w-[3.5rem] min-h-11 transition-colors ${
                isActive ? 'text-accent' : 'text-text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                <span className="text-[11px] font-semibold leading-tight tracking-tight">
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
