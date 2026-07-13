import { describe, expect, it } from 'vitest'
import {
  approximateSunriseSunsetMinutes,
  resolveTheme,
  themeFromLocalClock,
} from '../utils/dayNightTheme'

describe('day/night theme from local clock', () => {
  it('is light around midday', () => {
    const noon = new Date(2026, 6, 14, 12, 0, 0) // Jul 14 local
    expect(themeFromLocalClock(noon)).toBe('light')
  })

  it('is dark late at night', () => {
    const night = new Date(2026, 6, 14, 23, 30, 0)
    expect(themeFromLocalClock(night)).toBe('dark')
  })

  it('is dark before sunrise', () => {
    const early = new Date(2026, 6, 14, 3, 0, 0)
    expect(themeFromLocalClock(early)).toBe('dark')
  })

  it('resolves auto vs locked preferences', () => {
    const noon = new Date(2026, 6, 14, 12, 0, 0)
    expect(resolveTheme('auto', noon)).toBe('light')
    expect(resolveTheme('dark', noon)).toBe('dark')
    expect(resolveTheme('light', noon)).toBe('light')
  })

  it('computes sunrise before sunset', () => {
    const { sunrise, sunset } = approximateSunriseSunsetMinutes(new Date(2026, 6, 14))
    expect(sunrise).toBeLessThan(sunset)
    expect(sunrise).toBeGreaterThan(4 * 60)
    expect(sunset).toBeLessThan(21 * 60)
  })
})
