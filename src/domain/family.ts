/** Household / family rollup across members & portfolios. */

import type { FamilyState, NetWorthBreakdown } from './types'

export type { FamilyMember, FamilyMemberType, FamilySettings, FamilyState } from './types'

export function emptyFamily(): FamilyState {
  return {
    members: [
      {
        id: 'primary',
        name: 'You',
        role: 'Primary',
        type: 'primary',
        isActive: true,
      },
    ],
    settings: { combined: true, shareDebt: true, familyPrivacy: false },
  }
}

export interface FamilyTotals {
  netWorth: number
  assets: number
  debt: number
  contributions: { id: string; name: string; netWorth: number; pct: number }[]
}

export function calcFamilyTotals(
  primary: NetWorthBreakdown,
  family: FamilyState,
  portfolioBreakdowns: Map<string, NetWorthBreakdown>,
): FamilyTotals {
  const contributions: FamilyTotals['contributions'] = []
  let netWorth = 0
  let assets = 0
  let debt = 0

  for (const m of family.members.filter((x) => x.isActive)) {
    let nw = 0
    let a = 0
    let d = 0
    if (m.portfolioId && portfolioBreakdowns.has(m.portfolioId)) {
      const b = portfolioBreakdowns.get(m.portfolioId)!
      nw = b.netWorth
      a = b.assets
      d = b.liabilities
    } else if (m.id === 'primary' || m.type === 'primary') {
      nw = primary.netWorth
      a = primary.assets
      d = primary.liabilities
    } else {
      nw = m.networth ?? 0
      a = m.assets ?? 0
      d = m.debt ?? 0
    }
    netWorth += nw
    assets += a
    if (family.settings.shareDebt) debt += d
    contributions.push({ id: m.id, name: m.name, netWorth: nw, pct: 0 })
  }

  for (const c of contributions) {
    c.pct = netWorth !== 0 ? (c.netWorth / Math.abs(netWorth)) * 100 : 0
  }

  return { netWorth, assets, debt, contributions }
}
