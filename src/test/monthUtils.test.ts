import { describe, expect, it } from 'vitest'
import { daysElapsedInMonth, daysInMonth, monthKey } from '../domain/monthUtils'

describe('daysElapsedInMonth', () => {
  it('uses full month length for past months', () => {
    const now = new Date(2026, 6, 15) // Jul 15 2026
    expect(daysElapsedInMonth('2026-06', now)).toBe(30)
    expect(daysInMonth('2026-06')).toBe(30)
  })

  it('uses today for the current month', () => {
    const now = new Date(2026, 6, 13) // Jul 13 2026
    expect(daysElapsedInMonth(monthKey(now), now)).toBe(13)
  })

  it('uses 1 day for future months (avoid divide-by-zero blow-up)', () => {
    const now = new Date(2026, 6, 15)
    expect(daysElapsedInMonth('2026-08', now)).toBe(1)
  })
})
