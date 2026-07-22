import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BACKUP_NUDGE_DISMISS_ID,
  calendarMonthDismissUntil,
  clearAlertDismiss,
  concentrationDismissId,
  dismissAlertForCalendarMonth,
  isAlertDismissed,
} from '../domain/alertDismiss'
import {
  buildChartAxisRows,
  chartXIntervalFor,
  formatChartTick,
  formatChartXTick,
  formatChartYTick,
} from '../domain/chartAxis'
import { setDisplayCurrency } from '../utils/format'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('alertDismiss — calendar-month quiet', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })
  afterEach(() => mem.clear())

  it('hides until the first of the month after next', () => {
    const now = new Date(2026, 6, 22) // 22 Jul 2026
    expect(calendarMonthDismissUntil(now)).toBe('2026-09-01')
    const id = concentrationDismissId('TSLA')
    dismissAlertForCalendarMonth(id, now)
    expect(isAlertDismissed(id, now)).toBe(true)
    expect(isAlertDismissed(id, new Date(2026, 7, 15))).toBe(true) // Aug
    expect(isAlertDismissed(id, new Date(2026, 8, 1))).toBe(false) // Sep 1
    clearAlertDismiss(id)
    expect(isAlertDismissed(id, now)).toBe(false)
  })

  it('scopes concentration by symbol', () => {
    expect(concentrationDismissId('tsla')).toBe('concentration:TSLA')
    expect(BACKUP_NUDGE_DISMISS_ID).toBe('backup-nudge')
  })
})

describe('chartAxis — range-aware X / currency Y', () => {
  it('picks intervals by range', () => {
    const yearPts = Array.from({ length: 12 }, (_, i) => ({
      date: `2025-${String(i + 1).padStart(2, '0')}-15`,
    }))
    expect(chartXIntervalFor('1D', yearPts)).toBe('hour')
    expect(chartXIntervalFor('1W', yearPts)).toBe('day')
    expect(chartXIntervalFor('1M', yearPts)).toBe('week')
    expect(chartXIntervalFor('12M', yearPts)).toBe('month')
    expect(chartXIntervalFor('5Y', yearPts)).toBe('year')
  })

  it('12M axis ticks are unique months (not Jul 26 × N)', () => {
    const pts = Array.from({ length: 12 }, (_, i) => ({
      date: `2025-${String(i + 1).padStart(2, '0')}-15`,
    }))
    const { rows, tickKeys, interval } = buildChartAxisRows(pts, '12M')
    expect(interval).toBe('month')
    expect(rows.every((r) => r.xKey)).toBe(true)
    const labels = tickKeys.map((k) => rows.find((r) => r.xKey === k)?.tick)
    const unique = new Set(labels)
    expect(unique.size).toBeGreaterThan(6)
    expect([...unique].every((l) => l && !/^Jul 26$/.test(l))).toBe(true)
  })

  it('1D formats hourly; 5Y yearly', () => {
    expect(formatChartXTick('2026-07-22', 'hour', '2026-07-22T14:30:00.000Z')).toMatch(/14:30|2:30/)
    expect(formatChartTick('2026-07-22', '5Y')).toBe('2026')
    expect(formatChartTick('2026-07-22', '12M')).toMatch(/Jul/)
  })

  it('Y ticks stay compact across GBP / USD / THB / BTC', () => {
    setDisplayCurrency('GBP', { GBP: 1, USD: 1.27, THB: 45, BTC: 0.000012 })
    expect(formatChartYTick(160_000)).toMatch(/160/)
    setDisplayCurrency('USD', { GBP: 1, USD: 1.27, THB: 45, BTC: 0.000012 })
    expect(formatChartYTick(160_000)).toMatch(/USD|\$|203/)
    setDisplayCurrency('THB', { GBP: 1, USD: 1.27, THB: 45, BTC: 0.000012 })
    const thb = formatChartYTick(160_000)
    expect(thb.length).toBeLessThan(16)
    setDisplayCurrency('BTC', { GBP: 1, USD: 1.27, THB: 45, BTC: 0.000012 })
    expect(formatChartYTick(160_000)).toMatch(/₿/)
    setDisplayCurrency('GBP', { GBP: 1 })
  })
})
