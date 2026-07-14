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
  /** Midnight (NIGHT) — live CoinGecko id */
  NIGHT: 'midnight-3',
}

/** Last-resort static GBP prints when every live source fails (prefer live APIs). */
const MANUAL_DEFAULTS: Record<string, number> = {}

/** In-memory cache of symbol → CoinGecko id from search (session). */
const geckoSearchCache = new Map<string, string>()


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
  const idBySym = new Map<string, string>()
  await Promise.all(
    unique.map(async (s) => {
      const id = await lookupGeckoId(s)
      if (id) idBySym.set(s, id)
    }),
  )
  const geckoIds = [...new Set(idBySym.values())]
  const byGecko: Record<string, number> = {}

  if (geckoIds.length > 0) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds.join(',')}&vs_currencies=gbp`
    const data = await fetchJson<Record<string, { gbp?: number }>>(url)
    if (data) {
      for (const [sym, id] of idBySym) {
        const p = data[id]?.gbp
        if (p && p > 0) byGecko[sym] = p
      }
    }
  }

  const fx = await ensureFxRates()
  const out: CryptoPriceUpdate[] = []
  for (const symbol of unique) {
    if (byGecko[symbol]) {
      out.push({ symbol, price: byGecko[symbol], source: 'coingecko' })
      continue
    }
    try {
      const yahoo = await fetchCryptoYahooQuoteGbp(symbol, fx)
      if (yahoo && yahoo.priceGbp > 0) {
        // Yahoo is a live print; surface as coingecko-equivalent for portfolio callers
        out.push({ symbol, price: yahoo.priceGbp, source: 'coingecko' })
        continue
      }
    } catch {
      /* continue */
    }
    if (manualOverrides[symbol] > 0) {
      out.push({ symbol, price: manualOverrides[symbol], source: 'manual' })
      continue
    }
    if (MANUAL_DEFAULTS[symbol]) {
      out.push({ symbol, price: MANUAL_DEFAULTS[symbol], source: 'default' })
      continue
    }
    out.push({ symbol, price: 0, source: 'manual' })
  }
  return out
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
  const sym = symbol.toUpperCase()
  return GECKO_IDS[sym] ?? geckoSearchCache.get(sym)
}

export const KNOWN_CRYPTO_SYMBOLS = Object.keys(GECKO_IDS)

/** Resolve a CoinGecko id via search when the symbol is not in the built-in map. */
export async function lookupGeckoId(symbol: string): Promise<string | undefined> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return undefined
  const known = resolveGeckoId(sym)
  if (known) return known
  const cached = geckoSearchCache.get(sym)
  if (cached) return cached

  const data = await fetchJson<{
    coins?: Array<{ id?: string; symbol?: string; market_cap_rank?: number | null }>
  }>(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`, 8000)

  const coins = data?.coins ?? []
  const exact = coins
    .filter((c) => (c.symbol || '').toUpperCase() === sym && c.id)
    .sort((a, b) => (a.market_cap_rank ?? 999999) - (b.market_cap_rank ?? 999999))
  const id = exact[0]?.id
  if (id) {
    geckoSearchCache.set(sym, id)
    return id
  }
  return undefined
}

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
  sparkline?: number[]
  coingeckoId?: string
  source: 'coingecko' | 'yahoo' | 'manual' | 'default'
}

/** Yahoo crypto chart ticker e.g. ADA → ADA-USD */
function yahooCryptoSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (s.includes('-')) return s
  return `${s}-USD`
}

/** Live crypto quote via Yahoo (USD) converted to GBP — fallback when CoinGecko fails. */
export async function fetchCryptoYahooQuoteGbp(
  symbol: string,
  rates?: FxRates,
): Promise<CryptoMarketQuoteGbp | null> {
  const fx = rates ?? (await ensureFxRates())
  const ySym = yahooCryptoSymbol(symbol)
  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=5m&range=1d`
  const data = await fetchViaProxies<{
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number
          chartPreviousClose?: number
          previousClose?: number
          currency?: string
        }
        indicators?: { quote?: Array<{ close?: Array<number | null> }> }
      }>
    }
  }>(yahoo)

  const result = data?.chart?.result?.[0]
  const meta = result?.meta
  const priceUsd = meta?.regularMarketPrice
  if (!priceUsd || !(priceUsd > 0)) return null
  const prevUsd = meta?.chartPreviousClose || meta?.previousClose || priceUsd
  const priceGbp = usdToGbp(priceUsd, fx)
  const prevGbp = usdToGbp(prevUsd, fx)
  const changeAbs = priceGbp - prevGbp
  const changePct = prevGbp > 0 ? (changeAbs / prevGbp) * 100 : 0
  const closes = (result?.indicators?.quote?.[0]?.close || [])
    .filter((n): n is number => typeof n === 'number' && n > 0)
    .map((n) => usdToGbp(n, fx))

  return {
    symbol: symbol.toUpperCase(),
    priceGbp,
    changePct,
    sparkline: closes,
    source: 'yahoo',
  }
}

/**
 * Crypto quotes in GBP with 24h % change.
 * CoinGecko first (with search for unknown symbols), then Yahoo USD→GBP fallback.
 */
export async function fetchCryptoMarketQuotesGbp(
  items: Array<{ symbol: string; coingeckoId?: string }>,
  manualOverrides: Record<string, number> = {},
): Promise<CryptoMarketQuoteGbp[]> {
  const unique = new Map<string, string | undefined>()
  for (const item of items) {
    const sym = item.symbol.toUpperCase()
    if (!unique.has(sym)) unique.set(sym, item.coingeckoId)
  }

  // Resolve ids — built-in map, overrides, then CoinGecko search for unknowns
  const resolvedIds = new Map<string, string>()
  await Promise.all(
    [...unique.entries()].map(async ([sym, override]) => {
      const id = override?.trim() || (await lookupGeckoId(sym))
      if (id) resolvedIds.set(sym, id)
    }),
  )

  const idToSym = new Map<string, string>()
  for (const [sym, id] of resolvedIds) {
    idToSym.set(id, sym)
  }

  const bySym = new Map<
    string,
    { price: number; changePct: number; coingeckoId?: string; source: 'coingecko' }
  >()

  if (idToSym.size > 0) {
    const ids = [...idToSym.keys()].join(',')
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=gbp&include_24hr_change=true`
    const data = await fetchJson<Record<string, { gbp?: number; gbp_24h_change?: number }>>(url)
    if (data) {
      for (const [id, sym] of idToSym) {
        const row = data[id]
        const p = row?.gbp
        if (p && p > 0) {
          bySym.set(sym, {
            price: p,
            changePct: row?.gbp_24h_change ?? 0,
            coingeckoId: id,
            source: 'coingecko',
          })
        }
      }
    }
  }

  const fx = await ensureFxRates()
  const out: CryptoMarketQuoteGbp[] = []

  for (const symbol of unique.keys()) {
    const hit = bySym.get(symbol)
    if (hit) {
      out.push({
        symbol,
        priceGbp: hit.price,
        changePct: hit.changePct,
        coingeckoId: hit.coingeckoId,
        source: 'coingecko',
      })
      continue
    }

    // Live Yahoo fallback (covers CoinGecko rate limits / unknown ids)
    try {
      const yahoo = await fetchCryptoYahooQuoteGbp(symbol, fx)
      if (yahoo && yahoo.priceGbp > 0) {
        out.push({ ...yahoo, coingeckoId: resolvedIds.get(symbol) })
        continue
      }
    } catch {
      /* continue to manual */
    }

    if (manualOverrides[symbol] > 0) {
      out.push({
        symbol,
        priceGbp: manualOverrides[symbol],
        changePct: 0,
        coingeckoId: resolvedIds.get(symbol),
        source: 'manual',
      })
      continue
    }
    if (MANUAL_DEFAULTS[symbol]) {
      out.push({
        symbol,
        priceGbp: MANUAL_DEFAULTS[symbol],
        changePct: 0,
        coingeckoId: resolvedIds.get(symbol),
        source: 'default',
      })
      continue
    }
    out.push({
      symbol,
      priceGbp: 0,
      changePct: 0,
      coingeckoId: resolvedIds.get(symbol),
      source: 'manual',
    })
  }

  return out
}

/** Yahoo FX symbol for a fiat pair e.g. GBP/USD → GBPUSD=X */
export function yahooFxSymbol(base: string, quote: string): string {
  return `${base.toUpperCase()}${quote.toUpperCase()}=X`
}

export interface RateMarketQuote {
  last: number
  previousClose: number
  changeAbs: number
  changePct: number
  sparkline: number[]
  source: string
}

/** Fiat FX pair quote via Yahoo chart (intraday sparkline). */
export async function fetchFxPairQuote(base: string, quote: string): Promise<RateMarketQuote | null> {
  const ySym = yahooFxSymbol(base, quote)
  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=5m&range=1d`
  const data = await fetchViaProxies<{
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number
          chartPreviousClose?: number
          previousClose?: number
        }
        indicators?: { quote?: Array<{ close?: Array<number | null> }> }
      }>
    }
  }>(yahoo)

  const result = data?.chart?.result?.[0]
  const meta = result?.meta
  const price = meta?.regularMarketPrice
  if (!price || !(price > 0)) {
    // Fallback: exchangerate-api spot only (no sparkline / day change)
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(base)}`)
      if (res.ok) {
        const json = (await res.json()) as { rates?: Record<string, number> }
        const spot = json.rates?.[quote.toUpperCase()]
        if (typeof spot === 'number' && spot > 0) {
          return {
            last: spot,
            previousClose: spot,
            changeAbs: 0,
            changePct: 0,
            sparkline: [],
            source: 'exchangerate-api',
          }
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }

  const previousClose = meta?.chartPreviousClose || meta?.previousClose || price
  const changeAbs = price - previousClose
  const changePct = previousClose > 0 ? (changeAbs / previousClose) * 100 : 0
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter(
    (n): n is number => typeof n === 'number' && n > 0,
  )

  return {
    last: price,
    previousClose,
    changeAbs,
    changePct,
    sparkline: closes,
    source: 'yahoo',
  }
}

/** Crypto cross e.g. ADA/BTC via CoinGecko (quote in BTC) + 24h sparkline. */
export async function fetchCryptoCrossQuote(
  base: string,
  quote: string,
  baseGeckoId?: string,
): Promise<RateMarketQuote | null> {
  const baseId = baseGeckoId?.trim() || (await lookupGeckoId(base))
  const quoteId = await lookupGeckoId(quote)
  if (!baseId) {
    // Last resort: derive from Yahoo USD legs converted via GBP
    try {
      const [baseQ, quoteQ] = await Promise.all([
        fetchCryptoYahooQuoteGbp(base),
        fetchCryptoYahooQuoteGbp(quote),
      ])
      if (
        baseQ &&
        quoteQ &&
        baseQ.priceGbp > 0 &&
        quoteQ.priceGbp > 0
      ) {
        const last = baseQ.priceGbp / quoteQ.priceGbp
        const changePct = (baseQ.changePct ?? 0) - (quoteQ.changePct ?? 0)
        const previousClose = last / (1 + changePct / 100)
        return {
          last,
          previousClose,
          changeAbs: last - previousClose,
          changePct,
          sparkline: [],
          source: 'yahoo-derived',
        }
      }
    } catch {
      /* fall through */
    }
    return null
  }

  const vs = quote.toLowerCase()
  // CoinGecko vs_currencies supports btc, eth, and fiat — not arbitrary coin ids
  const supportedVs = new Set([
    'btc',
    'eth',
    'ltc',
    'bch',
    'bnb',
    'eos',
    'xrp',
    'xlm',
    'link',
    'dot',
    'yfi',
    'usd',
    'aed',
    'ars',
    'aud',
    'bdt',
    'bhd',
    'bmd',
    'brl',
    'cad',
    'chf',
    'clp',
    'cny',
    'czk',
    'dkk',
    'eur',
    'gbp',
    'hkd',
    'huf',
    'idr',
    'ils',
    'inr',
    'jpy',
    'krw',
    'kwd',
    'lkr',
    'mmk',
    'mxn',
    'myr',
    'ngn',
    'nok',
    'nzd',
    'php',
    'pkr',
    'pln',
    'rub',
    'sar',
    'sek',
    'sgd',
    'thb',
    'try',
    'twd',
    'uah',
    'vef',
    'vnd',
    'zar',
    'xdr',
    'xag',
    'xau',
    'bits',
    'sats',
  ])

  if (!supportedVs.has(vs)) {
    // Derive cross from both coins vs GBP
    if (!quoteId) return null
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${baseId},${quoteId}&vs_currencies=gbp&include_24hr_change=true`
    const data = await fetchJson<
      Record<string, { gbp?: number; gbp_24h_change?: number }>
    >(url)
    const baseGbp = data?.[baseId]?.gbp
    const quoteGbp = data?.[quoteId]?.gbp
    if (!(baseGbp && baseGbp > 0 && quoteGbp && quoteGbp > 0)) return null
    const last = baseGbp / quoteGbp
    // Approximate cross change from GBP changes (first-order)
    const baseCh = data?.[baseId]?.gbp_24h_change ?? 0
    const quoteCh = data?.[quoteId]?.gbp_24h_change ?? 0
    const changePct = baseCh - quoteCh
    const previousClose = last / (1 + changePct / 100)
    return {
      last,
      previousClose,
      changeAbs: last - previousClose,
      changePct,
      sparkline: [],
      source: 'coingecko-derived',
    }
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(baseId)}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true`
  const data = await fetchJson<Record<string, Record<string, number | undefined>>>(url)
  const row = data?.[baseId]
  const last = row?.[vs]
  if (!(typeof last === 'number' && last > 0)) return null
  const changePct = row?.[`${vs}_24h_change`] ?? 0
  const previousClose = last / (1 + changePct / 100)

  let sparkline: number[] = []
  try {
    const chartUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(baseId)}/market_chart?vs_currency=${encodeURIComponent(vs)}&days=1`
    const chart = await fetchJson<{ prices?: Array<[number, number]> }>(chartUrl, 12000)
    sparkline = (chart?.prices || [])
      .map((p) => p[1])
      .filter((n): n is number => typeof n === 'number' && n > 0)
  } catch {
    /* optional */
  }

  return {
    last,
    previousClose,
    changeAbs: last - previousClose,
    changePct,
    sparkline,
    source: 'coingecko',
  }
}

/** Optional 24h GBP sparkline for a single crypto (CoinGecko). */
export async function fetchCryptoGbpSparkline(
  symbol: string,
  coingeckoId?: string,
): Promise<number[]> {
  const id = coingeckoId?.trim() || (await lookupGeckoId(symbol))
  if (!id) return []
  const chartUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=gbp&days=1`
  const chart = await fetchJson<{ prices?: Array<[number, number]> }>(chartUrl, 12000)
  return (chart?.prices || [])
    .map((p) => p[1])
    .filter((n): n is number => typeof n === 'number' && n > 0)
}

