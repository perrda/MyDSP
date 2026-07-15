import { describe, it, expect } from 'vitest'
import {
  cleanSparklineCloses,
  downsampleGeckoPricesToDaily,
  sparklineTrendFromSeries,
  sparklineYDomain,
  takeLastSparklinePoints,
} from './sparklineSeries'

describe('sparklineSeries', () => {
  it('drops nulls and non-positive closes', () => {
    expect(cleanSparklineCloses([null, 0, -1, 10, undefined, 12])).toEqual([10, 12])
  })

  it('takes the last N daily closes', () => {
    expect(takeLastSparklinePoints([1, 2, 3, 4, 5, 6, 7, 8, 9], 7)).toEqual([3, 4, 5, 6, 7, 8, 9])
  })

  it('buckets CoinGecko hourly prices into one close per UTC day', () => {
    const day1 = Date.UTC(2026, 6, 1, 1)
    const day1b = Date.UTC(2026, 6, 1, 23)
    const day2 = Date.UTC(2026, 6, 2, 12)
    const day3 = Date.UTC(2026, 6, 3, 12)
    const out = downsampleGeckoPricesToDaily(
      [
        [day1, 100],
        [day1b, 105],
        [day2, 110],
        [day3, 108],
      ],
      7,
    )
    expect(out).toEqual([105, 110, 108])
  })

  it('derives stroke trend from first→last', () => {
    expect(sparklineTrendFromSeries([100, 101, 102])).toBe('up')
    expect(sparklineTrendFromSeries([100, 99, 98])).toBe('down')
    expect(sparklineTrendFromSeries([100, 100.01, 100])).toBe('neutral')
  })

  it('pads Y domain and never roots high prices at zero', () => {
    const [min, max] = sparklineYDomain([50000, 50500, 51000])
    expect(min).toBeGreaterThan(49000)
    expect(max).toBeLessThan(52000)
    expect(min).toBeLessThan(50000)
    expect(max).toBeGreaterThan(51000)
  })
})
