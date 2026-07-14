import { describe, expect, it } from 'vitest'
import { filterByRange, normalizeHistoryDate } from '../domain/history'
import { mergePortfolio } from '../services/sync/merge'
import { createEmptyPortfolio } from '../domain/defaults'
import { journalForSymbol } from '../domain/trades'

describe('sync reload crash guards', () => {
  it('normalizeHistoryDate tolerates missing dates', () => {
    expect(normalizeHistoryDate(undefined)).toBe('')
    expect(normalizeHistoryDate(null)).toBe('')
    expect(normalizeHistoryDate('2026-07-14T12:00:00.000Z')).toBe('2026-07-14')
  })

  it('filterByRange skips invalid history points', () => {
    const points = [
      { date: '2026-07-01', netWorth: 1 },
      { date: undefined as unknown as string, netWorth: 2 },
      { date: '2026-07-10', netWorth: 3 },
    ]
    const filtered = filterByRange(points, 'ALL')
    expect(filtered.every((p) => Boolean(p.date))).toBe(true)
    expect(filtered).toHaveLength(2)
  })

  it('mergePortfolio tolerates missing staking/family arrays', () => {
    const local = createEmptyPortfolio()
    const remote = {
      ...createEmptyPortfolio(),
      staking: { pool: local.staking.pool } as typeof local.staking,
      family: { settings: local.family.settings } as typeof local.family,
    }
    expect(() => mergePortfolio(local, remote)).not.toThrow()
  })

  it('journalForSymbol tolerates missing asset/date', () => {
    const data = createEmptyPortfolio()
    data.journal = [
      { id: 1, date: undefined as unknown as string, asset: undefined as unknown as string, type: 'buy', notes: '' },
      { id: 2, date: '2026-07-01', asset: 'BTC', type: 'buy', notes: '' },
    ] as typeof data.journal
    expect(() => journalForSymbol(data, 'BTC')).not.toThrow()
    expect(journalForSymbol(data, 'BTC')).toHaveLength(1)
  })
})
