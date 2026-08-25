import { describe, expect, it } from 'vitest'
import { calcFamilyTotals } from './family'
import type { FamilyState, NetWorthBreakdown } from './types'

function breakdown(assets: number, liabilities: number): NetWorthBreakdown {
  const netWorth = assets - liabilities
  const empty = { value: 0, cost: 0, pnl: 0, pct: 0 }
  return {
    netWorth,
    assets,
    liabilities,
    crypto: empty,
    equity: empty,
    liability: { cc: 0, loans: liabilities, total: liabilities, monthly: 0 },
  }
}

describe('calcFamilyTotals', () => {
  const primary = breakdown(10_000, 2_000)
  const partnerPortfolio = breakdown(6_000, 1_000)
  const family: FamilyState = {
    members: [
      { id: 'primary', name: 'You', role: 'Primary', type: 'primary', isActive: true },
      {
        id: 'partner',
        name: 'Partner',
        role: 'Partner',
        type: 'partner',
        isActive: true,
        portfolioId: 'p_partner',
      },
    ],
    settings: { combined: true, shareDebt: true, familyPrivacy: false },
  }
  const map = new Map<string, NetWorthBreakdown>([['p_partner', partnerPortfolio]])

  it('includes debt in rollup when shareDebt is on', () => {
    const totals = calcFamilyTotals(primary, family, map)
    expect(totals.assets).toBe(16_000)
    expect(totals.debt).toBe(3_000)
    expect(totals.netWorth).toBe(13_000)
    expect(totals.netWorth).toBe(totals.assets - totals.debt)
  })

  it('drops debt from household NW when shareDebt is off so the three figures reconcile', () => {
    const totals = calcFamilyTotals(
      primary,
      { ...family, settings: { ...family.settings, shareDebt: false } },
      map,
    )
    expect(totals.assets).toBe(16_000)
    expect(totals.debt).toBe(0)
    expect(totals.netWorth).toBe(16_000)
    expect(totals.contributions.map((c) => c.netWorth)).toEqual([10_000, 6_000])
  })

  it('reads settings.combined and does not double-count the same portfolioId', () => {
    const primaryOnly = calcFamilyTotals(
      primary,
      { ...family, settings: { ...family.settings, combined: false } },
      map,
    )
    expect(primaryOnly.assets).toBe(10_000)
    expect(primaryOnly.debt).toBe(2_000)
    expect(primaryOnly.contributions).toHaveLength(1)

    const dup: FamilyState = {
      ...family,
      members: [
        ...family.members,
        {
          id: 'clone',
          name: 'Clone',
          role: 'Partner',
          type: 'partner',
          isActive: true,
          portfolioId: 'p_partner',
        },
      ],
    }
    const totals = calcFamilyTotals(primary, dup, map)
    expect(totals.assets).toBe(16_000)
    expect(totals.debt).toBe(3_000)
    expect(totals.contributions).toHaveLength(2)
  })
})
