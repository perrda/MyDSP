import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CandlestickChart,
  Wallet,
  Target,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { useShowBottomNav } from '../../hooks/useShowBottomNav'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Touch primary nav — phone & tablet only; desktop uses the sidebar. */
const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/markets', label: 'Markets', icon: CandlestickChart },
  { to: '/spending', label: 'Spending', icon: Wallet },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const show = useShowBottomNav()
  if (!show) return null

  return (
    <nav
      className="bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-bg-elevated border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1 pt-1.5">
        {PRIMARY_NAV.map((item) => (
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
