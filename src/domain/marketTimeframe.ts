/** Markets sparkline / % change windows — sparkline and badge use the same series. */

export type MarketTimeframe = '24H' | '1W' | '1M' | '12M'

export const MARKET_TIMEFRAMES: MarketTimeframe[] = ['24H', '1W', '1M', '12M']

export function isMarketTimeframe(v: unknown): v is MarketTimeframe {
  return v === '24H' || v === '1W' || v === '1M' || v === '12M'
}

/** Yahoo chart interval + range for each Markets window. */
export function yahooChartParamsForTimeframe(tf: MarketTimeframe): {
  interval: string
  range: string
  fallbackRange?: string
  windowMs: number
  maxPoints: number
} {
  switch (tf) {
    case '1W':
      return {
        interval: '1h',
        range: '5d',
        fallbackRange: '1mo',
        windowMs: 7 * 24 * 60 * 60 * 1000,
        maxPoints: 48,
      }
    case '1M':
      return {
        interval: '1h',
        range: '1mo',
        fallbackRange: '3mo',
        windowMs: 31 * 24 * 60 * 60 * 1000,
        maxPoints: 48,
      }
    case '12M':
      return {
        interval: '1d',
        range: '1y',
        fallbackRange: '2y',
        windowMs: 366 * 24 * 60 * 60 * 1000,
        maxPoints: 64,
      }
    case '24H':
    default:
      return {
        interval: '5m',
        range: '1d',
        fallbackRange: '5d',
        windowMs: 24 * 60 * 60 * 1000,
        maxPoints: 48,
      }
  }
}

/** CoinGecko `days=` for market_chart. */
export function geckoDaysForTimeframe(tf: MarketTimeframe): number {
  switch (tf) {
    case '1W':
      return 7
    case '1M':
      return 30
    case '12M':
      return 365
    case '24H':
    default:
      return 1
  }
}

/** Frankfurter lookback days (FX pairs). */
export function frankfurterDaysForTimeframe(tf: MarketTimeframe): number {
  switch (tf) {
    case '1W':
      return 7
    case '1M':
      return 30
    case '12M':
      return 365
    case '24H':
    default:
      return 5
  }
}

export function timeframeLabel(tf: MarketTimeframe): string {
  return tf
}
