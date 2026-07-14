/** Markets watchlist — track equity/crypto quotes (price + daily change). */

export type MarketAssetKind = 'crypto' | 'equity'

export interface MarketTicker {
  id: string
  kind: MarketAssetKind
  /** Ticker symbol e.g. BTC, TSLA */
  symbol: string
  /** Display name e.g. Bitcoin, Tesla, Inc. */
  name: string
  /** Optional CoinGecko id when symbol is not in the built-in map */
  coingeckoId?: string
  createdAt: string
  sortOrder: number
}

export interface MarketsState {
  version: 1
  tickers: MarketTicker[]
  /** Section collapse prefs */
  collapsed: { crypto: boolean; equities: boolean }
  lastRefreshAt?: string
}

export interface MarketQuote {
  symbol: string
  kind: MarketAssetKind
  /** Last price in GBP (display currency base) */
  priceGbp: number
  /** Absolute day change in GBP */
  changeAbsGbp: number
  /** Day change percent */
  changePct: number
  /** Intraday sparkline points (equities); empty for crypto */
  sparkline: number[]
  /** Pre/post market % when available (equities) */
  extendedHours?: { session: 'pre' | 'post'; changePct: number }
  source: string
  updatedAt: string
}

export const DEFAULT_MARKET_TICKERS: Omit<MarketTicker, 'id' | 'createdAt' | 'sortOrder'>[] = [
  { kind: 'crypto', symbol: 'BTC', name: 'Bitcoin' },
  { kind: 'crypto', symbol: 'ETH', name: 'Ethereum' },
  { kind: 'equity', symbol: 'TSLA', name: 'Tesla, Inc.' },
  { kind: 'equity', symbol: 'MSTR', name: 'MicroStrategy Incorporated' },
]

export function createEmptyMarketsState(): MarketsState {
  const now = new Date().toISOString()
  return {
    version: 1,
    tickers: DEFAULT_MARKET_TICKERS.map((t, i) => ({
      ...t,
      id: `mkt_${t.kind}_${t.symbol.toLowerCase()}`,
      createdAt: now,
      sortOrder: i,
    })),
    collapsed: { crypto: false, equities: false },
  }
}

export function normalizeMarketSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\s+/g, '')
}

export function newMarketTickerId(kind: MarketAssetKind, symbol: string): string {
  return `mkt_${kind}_${normalizeMarketSymbol(symbol).toLowerCase()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}
