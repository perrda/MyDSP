/** Markets watchlist — equities, crypto, FX pairs, and crypto crosses. */

export type MarketAssetKind = 'crypto' | 'equity' | 'fx' | 'cross'

export interface MarketTicker {
  id: string
  kind: MarketAssetKind
  /** Ticker or pair e.g. BTC, TSLA, GBP/USD, ADA/BTC */
  symbol: string
  /** Display name e.g. Bitcoin, Pound / US Dollar */
  name: string
  /** Optional CoinGecko id when symbol is not in the built-in map */
  coingeckoId?: string
  createdAt: string
  sortOrder: number
}

export type MarketsCollapsed = {
  crypto: boolean
  equities: boolean
  fx: boolean
  crosses: boolean
}

export interface MarketsState {
  version: 1
  tickers: MarketTicker[]
  collapsed: MarketsCollapsed
  lastRefreshAt?: string
}

export interface MarketQuote {
  symbol: string
  kind: MarketAssetKind
  /**
   * Last print in native units:
   * - crypto/equity → GBP
   * - fx/cross → quote currency units per 1 base (e.g. USD per GBP, BTC per ADA)
   */
  last: number
  /** Absolute day change in the same units as `last` */
  changeAbs: number
  /** Day change percent */
  changePct: number
  /** Intraday / 24h sparkline in the same units as `last` */
  sparkline: number[]
  /** Unit suffix for display (GBP, USD, THB, BTC, …) */
  unit: string
  /** Preferred fraction digits */
  decimals: number
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
  { kind: 'fx', symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
  { kind: 'fx', symbol: 'GBP/THB', name: 'British Pound / Thai Baht' },
  { kind: 'cross', symbol: 'ADA/BTC', name: 'Cardano / Bitcoin' },
]

export const DEFAULT_COLLAPSED: MarketsCollapsed = {
  crypto: false,
  equities: false,
  fx: false,
  crosses: false,
}

export function createEmptyMarketsState(): MarketsState {
  const now = new Date().toISOString()
  return {
    version: 1,
    tickers: DEFAULT_MARKET_TICKERS.map((t, i) => ({
      ...t,
      id: `mkt_${t.kind}_${normalizeMarketSymbol(t.symbol).toLowerCase().replace(/\//g, '_')}`,
      createdAt: now,
      sortOrder: i,
    })),
    collapsed: { ...DEFAULT_COLLAPSED },
  }
}

/** Uppercase; keep a single `/` for pairs; strip spaces. */
export function normalizeMarketSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '/')
  const parts = cleaned.split('/').filter(Boolean)
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  return parts[0] ?? ''
}

export function parseRatePair(symbol: string): { base: string; quote: string } | null {
  const norm = normalizeMarketSymbol(symbol)
  const parts = norm.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return { base: parts[0], quote: parts[1] }
}

export function newMarketTickerId(kind: MarketAssetKind, symbol: string): string {
  const key = normalizeMarketSymbol(symbol).toLowerCase().replace(/\//g, '_')
  return `mkt_${kind}_${key}_${Math.random().toString(36).slice(2, 8)}`
}

export function defaultNameForPair(kind: MarketAssetKind, symbol: string): string {
  const pair = parseRatePair(symbol)
  if (!pair) return normalizeMarketSymbol(symbol)
  if (kind === 'fx') return `${pair.base} / ${pair.quote}`
  if (kind === 'cross') return `${pair.base} / ${pair.quote}`
  return normalizeMarketSymbol(symbol)
}

/** Merge missing seed FX/cross (and any other defaults) into an existing watchlist. */
export function mergeDefaultTickers(state: MarketsState): { state: MarketsState; added: string[] } {
  const added: string[] = []
  const tickers = [...state.tickers]
  const maxOrder = tickers.reduce((m, t) => Math.max(m, t.sortOrder), -1)
  let nextOrder = maxOrder + 1
  const now = new Date().toISOString()

  for (const d of DEFAULT_MARKET_TICKERS) {
    const sym = normalizeMarketSymbol(d.symbol)
    const exists = tickers.some(
      (t) => t.kind === d.kind && normalizeMarketSymbol(t.symbol) === sym,
    )
    if (exists) continue
    // Only auto-add FX + cross defaults for upgrades (don't re-add deleted crypto/equity)
    if (d.kind !== 'fx' && d.kind !== 'cross') continue
    tickers.push({
      ...d,
      symbol: sym,
      id: `mkt_${d.kind}_${sym.toLowerCase().replace(/\//g, '_')}`,
      createdAt: now,
      sortOrder: nextOrder++,
    })
    added.push(sym)
  }

  const collapsed: MarketsCollapsed = {
    crypto: Boolean(state.collapsed?.crypto),
    equities: Boolean(state.collapsed?.equities),
    fx: Boolean(state.collapsed?.fx),
    crosses: Boolean(state.collapsed?.crosses),
  }

  return {
    state: { ...state, version: 1, tickers, collapsed },
    added,
  }
}

export function formatMarketLast(quote: MarketQuote): string {
  if (!(quote.last > 0)) return '—'
  if (quote.kind === 'crypto' || quote.kind === 'equity') {
    // Caller typically uses formatGBPPrecise; keep a plain fallback here
    return quote.last.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  const body = quote.last.toLocaleString('en-GB', {
    minimumFractionDigits: quote.decimals,
    maximumFractionDigits: quote.decimals,
  })
  return `${body} ${quote.unit}`
}

export function formatMarketChangeAbs(quote: MarketQuote): string {
  const n = quote.changeAbs
  if (quote.kind === 'crypto' || quote.kind === 'equity') {
    const abs = Math.abs(n).toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (n > 0) return `+${abs}`
    if (n < 0) return `−${abs.replace('£', '£')}`
    return abs
  }
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const body = Math.abs(n).toLocaleString('en-GB', {
    minimumFractionDigits: Math.min(quote.decimals, 6),
    maximumFractionDigits: Math.min(quote.decimals, 6),
  })
  return `${sign}${body} ${quote.unit}`
}

export function rateDecimals(quoteUnit: string): number {
  const u = quoteUnit.toUpperCase()
  if (u === 'BTC' || u === 'ETH') return 8
  if (u === 'THB' || u === 'JPY') return 2
  if (u === 'USD' || u === 'EUR' || u === 'AUD' || u === 'CAD' || u === 'CHF' || u === 'SGD') {
    return 4
  }
  return 6
}
