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
import {
  BOTTOM_NAV_FIXED_END,
  BOTTOM_NAV_FIXED_START,
  DEFAULT_BOTTOM_NAV_MIDDLE,
  loadBottomNavMiddleSlots,
} from '../storage/bottomNavSlots'

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

/**
 * Bottom bar = Overview (fixed) · 3 user slots · Settings (fixed).
 * `middleSlots` overrides stored prefs when provided (tests / preview).
 */
export function resolveBottomNavItems(middleSlots?: string[]): BottomNavItem[] {
  const slots = middleSlots?.length ? middleSlots : loadBottomNavMiddleSlots()
  const picked: BottomNavItem[] = []
  const seen = new Set<string>()

  const start = BOTTOM_NAV_CATALOG[BOTTOM_NAV_FIXED_START]
  if (start) {
    picked.push(start)
    seen.add(start.to)
  }

  for (const path of slots) {
    if (path === BOTTOM_NAV_FIXED_START || path === BOTTOM_NAV_FIXED_END) continue
    const item = BOTTOM_NAV_CATALOG[path]
    if (!item || seen.has(item.to)) continue
    picked.push(item)
    seen.add(item.to)
    if (picked.length >= 4) break
  }

  for (const path of DEFAULT_BOTTOM_NAV_MIDDLE) {
    if (picked.length >= 4) break
    if (seen.has(path)) continue
    const item = BOTTOM_NAV_CATALOG[path]
    if (item) {
      picked.push(item)
      seen.add(path)
    }
  }

  const end = BOTTOM_NAV_CATALOG[BOTTOM_NAV_FIXED_END]
  if (end && !seen.has(end.to)) picked.push(end)
  return picked
}
