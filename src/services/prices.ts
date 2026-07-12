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
