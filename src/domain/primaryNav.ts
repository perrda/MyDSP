/** Primary information architecture — Today · Markets · Money · Plan · Household.
 *  Settings is always `/settings` (header / sidebar pin), never a sixth tab.
 *  Sidebar MENU lists News + YouTube after Household. Phone/tablet bottom nav
 *  keeps the five doors and adds a compact News + YouTube cluster (not seven equal tabs). */

import {
  LayoutDashboard,
  CandlestickChart,
  Wallet,
  Target,
  Users,
  Newspaper,
  Video,
  type LucideIcon,
} from 'lucide-react'

export interface PrimaryNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const PRIMARY_NAV: readonly PrimaryNavItem[] = [
  { to: '/', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/markets', label: 'Markets', icon: CandlestickChart },
  { to: '/money', label: 'Money', icon: Wallet },
  { to: '/plan', label: 'Plan', icon: Target },
  { to: '/household', label: 'Household', icon: Users },
]

/** Desktop sidebar + phone hamburger MENU — five doors then News · YouTube. */
export const SIDEBAR_NAV: readonly PrimaryNavItem[] = [
  ...PRIMARY_NAV,
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/youtube', label: 'YouTube', icon: Video },
]

/** Phone/tablet bottom-nav media pair — compact, not equal-width doors. */
export const PHONE_MEDIA_NAV: readonly PrimaryNavItem[] = [
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/youtube', label: 'YouTube', icon: Video },
]

export const PRIMARY_NAV_PATHS = PRIMARY_NAV.map((item) => item.to)

export function isPrimaryNavPath(path: string): boolean {
  return PRIMARY_NAV_PATHS.includes(path)
}
