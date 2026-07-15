/** Map sidebar favourites → bottom-nav tabs (phone/tablet). */

import {
  LayoutDashboard,
  CandlestickChart,
  Wallet,
  Target,
  Settings,
  Coins,
  TrendingUp,
  ListChecks,
  Briefcase,
  Newspaper,
  Video,
  Landmark,
  Receipt,
  type LucideIcon,
} from 'lucide-react'
import { DEFAULT_FAVOURITE_PATHS } from '../storage/navOrder'

export interface BottomNavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const BOTTOM_NAV_CATALOG: Record<string, BottomNavItem> = {
  '/': { to: '/', label: 'Overview', icon: LayoutDashboard },
  '/markets': { to: '/markets', label: 'Markets', icon: CandlestickChart },
  '/spending': { to: '/spending', label: 'Spending', icon: Wallet },
  '/goals': { to: '/goals', label: 'Goals', icon: Target },
  '/crypto': { to: '/crypto', label: 'Crypto', icon: Coins },
  '/equities': { to: '/equities', label: 'Equities', icon: TrendingUp },
  '/todos': { to: '/todos', label: 'To Do', icon: ListChecks },
  '/jobs': { to: '/jobs', label: 'Jobs', icon: Briefcase },
  '/news': { to: '/news', label: 'News', icon: Newspaper },
  '/youtube': { to: '/youtube', label: 'YouTube', icon: Video },
  '/liabilities': { to: '/liabilities', label: 'Debt', icon: Landmark },
  '/tax': { to: '/tax', label: 'Tax', icon: Receipt },
  '/settings': { to: '/settings', label: 'Settings', icon: Settings },
}

const FALLBACK = ['/', '/markets', '/spending', '/goals'] as const

/** Up to 4 favourite tabs + Settings (always last). */
export function resolveBottomNavItems(favourites: string[]): BottomNavItem[] {
  const picked: BottomNavItem[] = []
  const seen = new Set<string>()

  const source = favourites.length > 0 ? favourites : [...FALLBACK, ...DEFAULT_FAVOURITE_PATHS]
  for (const path of source) {
    if (path === '/settings') continue
    const item = BOTTOM_NAV_CATALOG[path]
    if (!item || seen.has(item.to)) continue
    picked.push(item)
    seen.add(item.to)
    if (picked.length >= 4) break
  }

  for (const path of FALLBACK) {
    if (picked.length >= 4) break
    if (seen.has(path)) continue
    const item = BOTTOM_NAV_CATALOG[path]
    if (item) {
      picked.push(item)
      seen.add(path)
    }
  }

  picked.push(BOTTOM_NAV_CATALOG['/settings'])
  return picked
}
