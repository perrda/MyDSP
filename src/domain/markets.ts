/** Markets watchlist — equities, crypto, commodities, FX, crosses, and indices. */

import { formatGBP, formatGBPMarket } from '../utils/format'
import {
  commodityDisplayName,
  DEFAULT_COMMODITIES,
  normalizeCommoditySymbol,
  COMMODITY_ALIASES,
} from './commodities'

export type MarketAssetKind = 'crypto' | 'equity' | 'commodity' | 'fx' | 'cross' | 'index'

/** Optional watchlist folder / tag for filter chips on Markets. */
export type MarketTickerTag = 'Core' | 'Speculative' | 'Income' | 'Other'

export const MARKET_TICKER_TAGS: MarketTickerTag[] = [
  'Core',
  'Speculative',
  'Income',
  'Other',
]

export interface MarketTicker {
  id: string
  kind: MarketAssetKind
  /** Ticker or pair e.g. BTC, TSLA, GBP/USD, ADA/BTC, ^GSPC */
  symbol: string
  /** Display name e.g. Bitcoin, S&P 500 */
  name: string
  /** Optional CoinGecko id when symbol is not in the built-in map */
  coingeckoId?: string
  /** Optional watch reason / personal note */
  notes?: string
  /** Optional folder/tag for watchlist filtering */
  tag?: MarketTickerTag
  /** Optional dividend yield % (equities) — manual stub */
  yieldPct?: number
  createdAt: string
  sortOrder: number
}

export type MarketsCollapsed = {
  crypto: boolean
  equities: boolean
  commodities: boolean
  indices: boolean
  fx: boolean
  crosses: boolean
}

export interface MarketsState {
  version: 1
  tickers: MarketTicker[]
  collapsed: MarketsCollapsed
  lastRefreshAt?: string
  /** Row density — compact hides names and tightens padding. */
  density?: 'comfortable' | 'compact'
  /** Markets % + sparkline window (badge and chart share the same series). */
  timeframe?: import('./marketTimeframe').MarketTimeframe
}

export type MarketsDensity = NonNullable<MarketsState['density']>

export interface MarketQuote {
  symbol: string
  kind: MarketAssetKind
  /**
   * Last print in native units:
   * - crypto/equity/commodity → GBP
   * - index → index points (native)
   * - fx/cross → quote currency units per 1 base
   */
  last: number
  changeAbs: number
  changePct: number
  /** Sparkline for the selected Markets timeframe (same units as `last`) */
  sparkline: number[]
  unit: string
  decimals: number
  extendedHours?: { session: 'pre' | 'post'; changePct: number }
  source: string
  updatedAt: string
}

export const DEFAULT_MARKET_TICKERS: Omit<MarketTicker, 'id' | 'createdAt' | 'sortOrder'>[] = [
  { kind: 'crypto', symbol: 'BTC', name: 'Bitcoin' },
  { kind: 'crypto', symbol: 'ETH', name: 'Ethereum' },
  { kind: 'equity', symbol: 'TSLA', name: 'Tesla, Inc.' },
  { kind: 'equity', symbol: 'MSTR', name: 'MicroStrategy Incorporated' },
  ...DEFAULT_COMMODITIES.map((c) => ({
    kind: 'commodity' as const,
    symbol: c.symbol,
    name: c.name,
  })),
  { kind: 'index', symbol: '^GSPC', name: 'S&P 500' },
  { kind: 'index', symbol: '^IXIC', name: 'Nasdaq Composite' },
  { kind: 'index', symbol: '^FTSE', name: 'FTSE 100' },
  { kind: 'fx', symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
  { kind: 'fx', symbol: 'GBP/THB', name: 'British Pound / Thai Baht' },
  { kind: 'cross', symbol: 'ADA/BTC', name: 'Cardano / Bitcoin' },
]

export const DEFAULT_COLLAPSED: MarketsCollapsed = {
  crypto: false,
  equities: false,
  commodities: false,
  indices: false,
  fx: false,
  crosses: false,
}

/** Friendly aliases → canonical Yahoo index symbol. */
export const INDEX_ALIASES: Record<string, { symbol: string; name: string }> = {
  SPX: { symbol: '^GSPC', name: 'S&P 500' },
  GSPC: { symbol: '^GSPC', name: 'S&P 500' },
  '^GSPC': { symbol: '^GSPC', name: 'S&P 500' },
  'S&P500': { symbol: '^GSPC', name: 'S&P 500' },
  'S&P': { symbol: '^GSPC', name: 'S&P 500' },
  NDX: { symbol: '^IXIC', name: 'Nasdaq Composite' },
  IXIC: { symbol: '^IXIC', name: 'Nasdaq Composite' },
  '^IXIC': { symbol: '^IXIC', name: 'Nasdaq Composite' },
  COMP: { symbol: '^IXIC', name: 'Nasdaq Composite' },
  NASDAQ: { symbol: '^IXIC', name: 'Nasdaq Composite' },
  FTSE: { symbol: '^FTSE', name: 'FTSE 100' },
  UKX: { symbol: '^FTSE', name: 'FTSE 100' },
  '^FTSE': { symbol: '^FTSE', name: 'FTSE 100' },
}

export function createEmptyMarketsState(): MarketsState {
  const now = new Date().toISOString()
  return {
    version: 1,
    tickers: DEFAULT_MARKET_TICKERS.map((t, i) => ({
      ...t,
      id: `mkt_${t.kind}_${normalizeMarketSymbol(t.symbol).toLowerCase().replace(/\//g, '_').replace(/\^/g, '')}`,
      createdAt: now,
      sortOrder: i,
    })),
    collapsed: { ...DEFAULT_COLLAPSED },
  }
}

/** Uppercase; keep `/` for pairs, `^` for indices, `=` for futures/spot; strip spaces. */
export function normalizeMarketSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase().replace(/\s+/g, '')
  // Indices: preserve caret, map aliases
  const asIndexKey = trimmed.replace(/-/g, '')
  if (INDEX_ALIASES[asIndexKey] || INDEX_ALIASES[trimmed]) {
    return (INDEX_ALIASES[asIndexKey] || INDEX_ALIASES[trimmed]).symbol
  }
  if (trimmed.startsWith('^')) return trimmed

  // Commodities: GC=F, XAUUSD=X, GOLD → GC=F
  if (COMMODITY_ALIASES[trimmed] || trimmed.includes('=')) {
    return normalizeCommoditySymbol(trimmed)
  }
  const cleaned = trimmed.replace(/-/g, '/')
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
  const key = normalizeMarketSymbol(symbol).toLowerCase().replace(/\//g, '_').replace(/\^/g, '')
  return `mkt_${kind}_${key}_${Math.random().toString(36).slice(2, 8)}`
}

export function defaultNameForPair(kind: MarketAssetKind, symbol: string): string {
  const norm = normalizeMarketSymbol(symbol)
  if (kind === 'index') {
    return INDEX_ALIASES[norm]?.name || norm
  }
  if (kind === 'commodity') {
    return commodityDisplayName(norm)
  }
  const pair = parseRatePair(symbol)
  if (!pair) return norm
  if (kind === 'fx' || kind === 'cross') return `${pair.base} / ${pair.quote}`
  return norm
}

/** Merge missing seed FX/cross/index/commodity defaults into an existing watchlist. */
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
    // Auto-add FX + cross + index + commodity defaults on upgrade (don't re-add deleted crypto/equity)
    if (d.kind !== 'fx' && d.kind !== 'cross' && d.kind !== 'index' && d.kind !== 'commodity') {
      continue
    }
    tickers.push({
      ...d,
      symbol: sym,
      id: `mkt_${d.kind}_${sym.toLowerCase().replace(/\//g, '_').replace(/\^/g, '').replace(/=/g, '_')}`,
      createdAt: now,
      sortOrder: nextOrder++,
    })
    added.push(sym)
  }

  const collapsed: MarketsCollapsed = {
    crypto: Boolean(state.collapsed?.crypto),
    equities: Boolean(state.collapsed?.equities),
    commodities: Boolean((state.collapsed as MarketsCollapsed | undefined)?.commodities),
    indices: Boolean((state.collapsed as MarketsCollapsed | undefined)?.indices),
    fx: Boolean((state.collapsed as MarketsCollapsed | undefined)?.fx),
    crosses: Boolean((state.collapsed as MarketsCollapsed | undefined)?.crosses),
  }

  return {
    state: { ...state, version: 1, tickers, collapsed },
    added,
  }
}

export function formatMarketLast(quote: MarketQuote): string {
  if (!(quote.last > 0)) return '—'
  if (quote.kind === 'crypto' || quote.kind === 'equity' || quote.kind === 'commodity') {
    return formatGBPMarket(quote.last)
  }
  if (quote.kind === 'index') {
    return quote.last.toLocaleString('en-GB', {
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
  if (quote.kind === 'crypto' || quote.kind === 'equity' || quote.kind === 'commodity') {
    return formatGBP(n, { signed: true })
  }
  if (quote.kind === 'index') {
    const body = Math.abs(n).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (n > 0) return `+${body}`
    if (n < 0) return `−${body}`
    return body
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
