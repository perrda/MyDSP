import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Target,
  Settings,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Mobile primary nav — Settings included so Cloud Sync is reachable on iPhone. */
const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/spending', label: 'Spending', icon: Wallet },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/crypto', label: 'Portfolio', icon: TrendingUp },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-bg-elevated border-t border-border pb-[env(safe-area-inset-bottom)] shadow-lg"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1 pt-2">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors min-w-[56px] ${
                isActive
                  ? 'text-accent bg-accent/10'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
