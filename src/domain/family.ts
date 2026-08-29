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

  const active = family.members.filter((x) => x.isActive)
  const members = family.settings.combined
    ? active
    : active.filter((m) => m.id === 'primary' || m.type === 'primary')
  const seenPortfolios = new Set<string>()

  for (const m of members) {
    let nw = 0
    let a = 0
    let d = 0
    if (m.portfolioId && portfolioBreakdowns.has(m.portfolioId)) {
      if (seenPortfolios.has(m.portfolioId)) continue
      seenPortfolios.add(m.portfolioId)
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
      // Manual members often enter only “NW” — treat that as assets so they
      // are not dropped when “Include debt in rollup” is off.
      if (!(a > 0) && !(d > 0) && nw > 0) a = nw
    }
    assets += a
    if (family.settings.shareDebt) {
      netWorth += nw
      debt += d
      contributions.push({ id: m.id, name: m.name, netWorth: nw, pct: 0 })
    } else {
      // "Include debt in rollup" off: contribute assets only so
      // Household NW + Household debt === Household assets.
      netWorth += a
      contributions.push({ id: m.id, name: m.name, netWorth: a, pct: 0 })
    }
  }

  for (const c of contributions) {
    c.pct = netWorth !== 0 ? (c.netWorth / Math.abs(netWorth)) * 100 : 0
  }

  return { netWorth, assets, debt, contributions }
}

export function memberBookLabel(
  member: { id: string; type: string; portfolioId?: string; name: string },
  portfolios: Array<{ id: string; name: string }>,
  activeId: string,
): string {
  if (member.portfolioId) {
    const named = portfolios.find((p) => p.id === member.portfolioId)?.name
    return named ? `${member.name} · ${named}` : `${member.name} · linked book`
  }
  if (member.id === 'primary' || member.type === 'primary') {
    const named = portfolios.find((p) => p.id === activeId)?.name
    return named ? `${member.name} · ${named}` : `${member.name} · this book`
  }
  return `${member.name} · manual figures`
}
