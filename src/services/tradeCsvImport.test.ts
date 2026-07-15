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

  it('detects Interactive Brokers-style headers', () => {
    const csv = `Trade Date,Buy/Sell,Quantity,T. Price,Comm/Fee
03/15/2024,BUY,10,180.50,1.00
`
    const r = parseTradeCsv(csv, { kind: 'equity', symbol: 'TSLA', dateOrder: 'mdy' })
    expect(r.broker?.id).toBe('ibkr')
    expect(r.trades).toHaveLength(1)
    expect(r.trades[0].side).toBe('buy')
    expect(r.trades[0].date).toBe('2024-03-15')
  })

  it('skips Coinbase transfer rows but keeps buys', () => {
    const csv = `Timestamp,Transaction Type,Quantity Transacted,Price at Transaction,Fees
2024-01-10T12:00:00Z,Buy,0.01,45000,1.5
2024-01-11T12:00:00Z,Send,0.001,46000,0
`
    const r = parseTradeCsv(csv, { kind: 'crypto', symbol: 'BTC', dateOrder: 'mdy' })
    expect(r.broker?.id).toBe('coinbase')
    expect(r.trades).toHaveLength(1)
    expect(r.errors.some((e) => e.includes('skipped'))).toBe(true)
  })
})
