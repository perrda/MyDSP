/** CoinGecko + Finnhub live price refresh (ported from FCC, MyDSP-native). */

import { equityNeedsUsdToGbp } from '../domain/equityCurrency'
import {
  ensureFxRates,
  loadCachedFxRates,
  usdToGbp,
  type FxRates,
} from './fx'

const GECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ADA: 'cardano',
  USDC: 'usd-coin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  LINK: 'chainlink',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
}

const MANUAL_DEFAULTS: Record<string, number> = {
  NIGHT: 0.0635,
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface CryptoPriceUpdate {
  symbol: string
  price: number
  source: 'coingecko' | 'manual' | 'default'
}

export async function fetchCryptoPricesGbp(
  symbols: string[],
  manualOverrides: Record<string, number> = {},
): Promise<CryptoPriceUpdate[]> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))]
  const geckoIds = unique.map((s) => GECKO_IDS[s]).filter(Boolean)
  const byGecko: Record<string, number> = {}

  if (geckoIds.length > 0) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds.join(',')}&vs_currencies=gbp`
    const data = await fetchJson<Record<string, { gbp?: number }>>(url)
    if (data) {
      for (const [sym, id] of Object.entries(GECKO_IDS)) {
        const p = data[id]?.gbp
        if (p && p > 0) byGecko[sym] = p
      }
    }
  }

  return unique.map((symbol) => {
    if (byGecko[symbol]) {
      return { symbol, price: byGecko[symbol], source: 'coingecko' as const }
    }
    if (manualOverrides[symbol] > 0) {
      return { symbol, price: manualOverrides[symbol], source: 'manual' as const }
    }
    if (MANUAL_DEFAULTS[symbol]) {
      return { symbol, price: MANUAL_DEFAULTS[symbol], source: 'default' as const }
    }
    return { symbol, price: 0, source: 'manual' as const }
  })
}

/** Raw market quote in the venue’s native currency (USD for US equities). */
export async function fetchEquityQuote(
  symbol: string,
  finnhubKey: string,
): Promise<number | null> {
  const sym = symbol.toUpperCase()
  if (finnhubKey.trim()) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(finnhubKey.trim())}`
    const data = await fetchJson<{ c?: number }>(url)
    if (data?.c && data.c > 0) return data.c
  }

  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(yahoo)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahoo)}`,
  ]
  for (const proxy of proxies) {
    const data = await fetchJson<{
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> }
    }>(proxy, 8000)
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (price && price > 0) return price
  }
  return null
}

/**
 * Equity prices in GBP (US listings converted via daily GBPUSD).
 */
export async function fetchEquityPrices(
  symbols: string[],
  finnhubKey: string,
  rates?: FxRates,
): Promise<Record<string, number>> {
  const fx = rates ?? (await ensureFxRates())
  const out: Record<string, number> = {}
  for (const symbol of symbols) {
    const raw = await fetchEquityQuote(symbol, finnhubKey)
    if (!raw || !(raw > 0)) continue
    const sym = symbol.toUpperCase()
    out[sym] = equityNeedsUsdToGbp(sym) ? usdToGbp(raw, fx) : raw
  }
  return out
}

/** Convert a single native equity quote to GBP storage units. */
export function equityQuoteToGbp(
  symbol: string,
  nativePrice: number,
  rates: FxRates = loadCachedFxRates(),
): number {
  if (!(nativePrice > 0)) return 0
  return equityNeedsUsdToGbp(symbol) ? usdToGbp(nativePrice, rates) : nativePrice
}

export function resolveGeckoId(symbol: string, override?: string): string | undefined {
  if (override?.trim()) return override.trim()
  return GECKO_IDS[symbol.toUpperCase()]
}

export const KNOWN_CRYPTO_SYMBOLS = Object.keys(GECKO_IDS)

async function fetchViaProxies<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ]
  for (const proxy of proxies) {
    const data = await fetchJson<T>(proxy, timeoutMs)
    if (data) return data
  }
  return fetchJson<T>(url, timeoutMs)
}

export interface EquityMarketQuoteNative {
  price: number
  previousClose: number
  changePct: number
  changeAbs: number
  sparkline: number[]
  extendedHours?: { session: 'pre' | 'post'; changePct: number }
  source: 'finnhub' | 'yahoo'
}

/** Full equity quote with day change + intraday sparkline (native venue currency). */
export async function fetchEquityMarketQuote(
  symbol: string,
  finnhubKey: string,
): Promise<EquityMarketQuoteNative | null> {
  const sym = symbol.toUpperCase()

  if (finnhubKey.trim()) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(finnhubKey.trim())}`
    const data = await fetchJson<{ c?: number; d?: number; dp?: number; pc?: number }>(url)
    if (data?.c && data.c > 0) {
      const previousClose = data.pc && data.pc > 0 ? data.pc : data.c - (data.d ?? 0)
      const changeAbs = data.d ?? data.c - previousClose
      const changePct =
        data.dp ?? (previousClose > 0 ? ((data.c - previousClose) / previousClose) * 100 : 0)
      // Sparkline from Yahoo even when Finnhub supplies the print
      const spark = await fetchYahooIntradaySparkline(sym)
      return {
        price: data.c,
        previousClose,
        changeAbs,
        changePct,
        sparkline: spark,
        source: 'finnhub',
      }
    }
  }

  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=5m&range=1d`
  const data = await fetchViaProxies<{
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number
          chartPreviousClose?: number
          previousClose?: number
          preMarketPrice?: number
          postMarketPrice?: number
          instrumentType?: string
        }
        indicators?: { quote?: Array<{ close?: Array<number | null> }> }
      }>
    }
  }>(yahoo)

  const result = data?.chart?.result?.[0]
  const meta = result?.meta
  const price = meta?.regularMarketPrice
  if (!price || !(price > 0)) return null
  const previousClose = meta?.chartPreviousClose || meta?.previousClose || price
  const changeAbs = price - previousClose
  const changePct = previousClose > 0 ? (changeAbs / previousClose) * 100 : 0
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter(
    (n): n is number => typeof n === 'number' && n > 0,
  )

  let extendedHours: EquityMarketQuoteNative['extendedHours']
  if (meta?.postMarketPrice && meta.postMarketPrice > 0 && price > 0) {
    extendedHours = {
      session: 'post',
      changePct: ((meta.postMarketPrice - price) / price) * 100,
    }
  } else if (meta?.preMarketPrice && meta.preMarketPrice > 0 && previousClose > 0) {
    extendedHours = {
      session: 'pre',
      changePct: ((meta.preMarketPrice - previousClose) / previousClose) * 100,
    }
  }

  return {
    price,
    previousClose,
    changeAbs,
    changePct,
    sparkline: closes,
    extendedHours,
    source: 'yahoo',
  }
}

async function fetchYahooIntradaySparkline(symbol: string): Promise<number[]> {
  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`
  const data = await fetchViaProxies<{
    chart?: {
      result?: Array<{ indicators?: { quote?: Array<{ close?: Array<number | null> }> } }>
    }
  }>(yahoo, 6000)
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []
  return closes.filter((n): n is number => typeof n === 'number' && n > 0)
}

export interface CryptoMarketQuoteGbp {
  symbol: string
  priceGbp: number
  changePct: number
  source: 'coingecko' | 'manual' | 'default'
}

/** Crypto quotes in GBP with 24h % change (CoinGecko). */
export async function fetchCryptoMarketQuotesGbp(
  items: Array<{ symbol: string; coingeckoId?: string }>,
  manualOverrides: Record<string, number> = {},
): Promise<CryptoMarketQuoteGbp[]> {
  const unique = new Map<string, string | undefined>()
  for (const item of items) {
    const sym = item.symbol.toUpperCase()
    if (!unique.has(sym)) unique.set(sym, item.coingeckoId)
  }

  const idToSym = new Map<string, string>()
  for (const [sym, override] of unique) {
    const id = resolveGeckoId(sym, override)
    if (id) idToSym.set(id, sym)
  }

  const bySym = new Map<string, { price: number; changePct: number }>()
  if (idToSym.size > 0) {
    const ids = [...idToSym.keys()].join(',')
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=gbp&include_24hr_change=true`
    const data = await fetchJson<Record<string, { gbp?: number; gbp_24h_change?: number }>>(url)
    if (data) {
      for (const [id, sym] of idToSym) {
        const row = data[id]
        const p = row?.gbp
        if (p && p > 0) {
          bySym.set(sym, { price: p, changePct: row?.gbp_24h_change ?? 0 })
        }
      }
    }
  }

  return [...unique.keys()].map((symbol) => {
    const hit = bySym.get(symbol)
    if (hit) {
      return {
        symbol,
        priceGbp: hit.price,
        changePct: hit.changePct,
        source: 'coingecko' as const,
      }
    }
    if (manualOverrides[symbol] > 0) {
      return {
        symbol,
        priceGbp: manualOverrides[symbol],
        changePct: 0,
        source: 'manual' as const,
      }
    }
    if (MANUAL_DEFAULTS[symbol]) {
      return {
        symbol,
        priceGbp: MANUAL_DEFAULTS[symbol],
        changePct: 0,
        source: 'default' as const,
      }
    }
    return { symbol, priceGbp: 0, changePct: 0, source: 'manual' as const }
  })
}

