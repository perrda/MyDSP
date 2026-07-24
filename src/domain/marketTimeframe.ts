/** Markets sparkline / % change windows — sparkline and badge use the same series. */

export type MarketTimeframe = '24H' | '1W' | '1M' | '12M' | 'YTD' | 'ALL'

export const MARKET_TIMEFRAMES: MarketTimeframe[] = ['24H', '1W', '1M', '12M', 'YTD', 'ALL']

/** Product default for % change + sparklines on every fresh app/session open. */
export const DEFAULT_MARKET_TF: MarketTimeframe = '24H'

/** Background Markets quote poll while the tab stays open (ms). */
export const MARKETS_QUOTE_POLL_MS = 60_000

const SESSION_TF_BOOT_KEY = 'mydsp_markets_tf_session_v1'

/**
 * Timeframe for a fresh browser session always starts at 24H.
 * After the user picks another window in this session, that choice is kept until reload.
 */
export function bootMarketsTimeframe(persisted: MarketTimeframe | undefined): MarketTimeframe {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_TF_BOOT_KEY) === '1') {
      return isMarketTimeframe(persisted) ? persisted : DEFAULT_MARKET_TF
    }
    sessionStorage?.setItem(SESSION_TF_BOOT_KEY, '1')
  } catch {
    /* private mode — still return default */
  }
  return DEFAULT_MARKET_TF
}

export function isMarketTimeframe(v: unknown): v is MarketTimeframe {
  return (
    v === '24H' ||
    v === '1W' ||
    v === '1M' ||
    v === '12M' ||
    v === 'YTD' ||
    v === 'ALL'
  )
}

function daysSinceYearStart(now = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
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
    case 'YTD': {
      const days = daysSinceYearStart()
      return {
        interval: '1d',
        range: 'ytd',
        fallbackRange: '1y',
        windowMs: days * 24 * 60 * 60 * 1000,
        maxPoints: 96,
      }
    }
    case 'ALL':
      return {
        interval: '1wk',
        range: 'max',
        fallbackRange: '10y',
        windowMs: 10 * 366 * 24 * 60 * 60 * 1000,
        maxPoints: 120,
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
export function geckoDaysForTimeframe(tf: MarketTimeframe): number | 'max' {
  switch (tf) {
    case '1W':
      return 7
    case '1M':
      return 30
    case '12M':
      return 365
    case 'YTD':
      return daysSinceYearStart()
    case 'ALL':
      return 'max'
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
    case 'YTD':
      return daysSinceYearStart()
    case 'ALL':
      return 3650
    case '24H':
    default:
      return 5
  }
}

export function timeframeLabel(tf: MarketTimeframe): string {
  return tf
}
