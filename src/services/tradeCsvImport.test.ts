import { describe, expect, it } from 'vitest'
import { normalizeTradeCsvDate, parseTradeCsv } from '../services/tradeCsvImport'

describe('tradeCsvImport', () => {
  it('prefers D/M/Y by default when both parts ≤12', () => {
    expect(normalizeTradeCsvDate('03/04/2020')).toBe('2020-04-03')
    expect(normalizeTradeCsvDate('03/04/2020', 'mdy')).toBe('2020-03-04')
  })

  it('resolves unambiguous day/month regardless of order', () => {
    expect(normalizeTradeCsvDate('15/03/2020')).toBe('2020-03-15')
    expect(normalizeTradeCsvDate('03/15/2020')).toBe('2020-03-15')
  })

  it('ignores extra columns and currency symbols', () => {
    const csv = `date,side,qty,price,fees,symbol,ticker
2024-01-10,buy,2,"£180.50",1.00,TSLA,TSLA
`
    const r = parseTradeCsv(csv, { kind: 'equity', symbol: 'TSLA' })
    expect(r.errors).toEqual([])
    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].price).toBe(180.5)
    expect(r.trades[0].symbol).toBe('TSLA')
  })

  it('folds platform into notes when notes column present', () => {
    const csv = `date,side,qty,price,fees,notes,platform
2024-02-01,buy,1,100,0,Top-up,IBKR
`
    const r = parseTradeCsv(csv, { kind: 'equity', symbol: 'MSTR' })
    expect(r.trades[0].notes).toContain('IBKR')
    expect(r.trades[0].platform).toBe('IBKR')
  })
})
