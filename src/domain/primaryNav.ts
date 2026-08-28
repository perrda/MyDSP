/** Primary information architecture — Today · Markets · Money · Plan · Household.
 *  Settings is always `/settings` (header / sidebar pin), never a sixth tab. */

import {
  LayoutDashboard,
  CandlestickChart,
  Wallet,
  Target,
  Users,
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

export const PRIMARY_NAV_PATHS = PRIMARY_NAV.map((item) => item.to)

export function isPrimaryNavPath(path: string): boolean {
  return PRIMARY_NAV_PATHS.includes(path)
}
