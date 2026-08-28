/** Bottom bar = Today · Markets · Money · Plan · Household (fixed).
 *  Settings stays at `/settings` in the header / sidebar pin. */

import { PRIMARY_NAV, type PrimaryNavItem } from './primaryNav'

export interface BottomNavItem {
  to: string
  label: string
  icon: PrimaryNavItem['icon']
}

export const BOTTOM_NAV_CATALOG: Record<string, BottomNavItem> = Object.fromEntries(
  PRIMARY_NAV.map((item) => [item.to, { to: item.to, label: item.label, icon: item.icon }]),
)

/**
 * Fixed five-tab IA. `middleSlots` is ignored (legacy prefs still sync).
 */
export function resolveBottomNavItems(_middleSlots?: string[]): BottomNavItem[] {
  return PRIMARY_NAV.map((item) => ({
    to: item.to,
    label: item.label,
    icon: item.icon,
  }))
}
