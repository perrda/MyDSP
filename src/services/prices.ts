/** CoinGecko + Finnhub + Yahoo live price refresh (MyDSP-native). */

import { equityNeedsUsdToGbp } from '../domain/equityCurrency'
import {
  frankfurterDaysForTimeframe,
  geckoDaysForTimeframe,
  yahooChartParamsForTimeframe,
  type MarketTimeframe,
} from '../domain/marketTimeframe'
import {
  changePctFromSeries,
  cleanSparklineCloses,
  downsampleGeckoPricesIntraday,
  downsampleIntradayPoints,
  takeLastSparklinePoints,
} from '../domain/sparklineSeries'
import {
  ensureFxRates,
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
  /** Midnight (IOG) — live CoinGecko id */
  NIGHT: 'midnight-3',
}

/**
 * Yahoo crypto chart symbols when `SYMBOL-USD` is wrong or ambiguous.
 * NIGHT-USD is a different token (~$0.08); IOG Midnight is NIGHT39064-USD.
 */
const YAHOO_CRYPTO_SYMBOLS: Record<string, string> = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  ADA: 'ADA-USD',
  USDC: 'USDC-USD',
  SOL: 'SOL-USD',
  XRP: 'XRP-USD',
  DOGE: 'DOGE-USD',
  DOT: 'DOT-USD',
  LINK: 'LINK-USD',
  AVAX: 'AVAX-USD',
  NIGHT: 'NIGHT39064-USD',
}

/** CoinCap asset ids (CORS-friendly public API). */
const COINCAP_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  ADA: 'cardano',
  USDC: 'usd-coin',
  SOL: 'solana',
  XRP: 'xrp',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  LINK: 'chainlink',
  AVAX: 'avalanche',
  MATIC: 'polygon',
}

/** Last-resort static GBP prints when every live source fails (prefer live APIs). */
const MANUAL_DEFAULTS: Record<string, number> = {}

/** In-memory cache of symbol → CoinGecko id from search (session). */
const geckoSearchCache = new Map<string, string>()

/** After a CoinGecko 429, skip further Gecko calls briefly. */
let geckoCooldownUntil = 0

/** Default Markets window — % badge and sparkline always share the same series. */
const DEFAULT_MARKET_TF: MarketTimeframe = '24H'
const SPARKLINE_HOURS = 24
const SPARKLINE_MAX_POINTS = 48

function yahooSparklineFromCloses(
  closes: Array<number | null | undefined>,
  maxPoints = SPARKLINE_MAX_POINTS,
): number[] {
  return takeLastSparklinePoints(cleanSparklineCloses(closes), maxPoints)
}

type YahooChartResult = {
  meta?: {
    regularMarketPrice?: number
    chartPreviousClose?: number
    previousClose?: number
    preMarketPrice?: number
    postMarketPrice?: number
    currency?: string
  }
  timestamp?: number[]
  indicators?: { quote?: Array<{ close?: Array<number | null> }> }
}

function sparklineFromYahooResult(
  result: YahooChartResult | undefined,
  opts?: { windowMs?: number; maxPoints?: number },
): number[] {
  const windowMs = opts?.windowMs ?? yahooChartParamsForTimeframe(DEFAULT_MARKET_TF).windowMs
  const maxPoints = opts?.maxPoints ?? SPARKLINE_MAX_POINTS
  const stamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  if (stamps.length > 0 && closes.length > 0) {
    const latest =
      stamps.reduce((m, t) => (typeof t === 'number' ? Math.max(m, t) : m), 0) * 1000
    const cutoff = latest > 0 ? latest - windowMs : 0
    const points: Array<{ t: number; price: number }> = []
    const n = Math.min(stamps.length, closes.length)
    for (let i = 0; i < n; i++) {
      const tSec = stamps[i]
      const price = closes[i]
      if (typeof tSec !== 'number' || !(typeof price === 'number' && price > 0)) continue
      const t = tSec * 1000
      if (cutoff > 0 && t < cutoff) continue
      points.push({ t, price })
    }
    const sampled = downsampleIntradayPoints(points, maxPoints)
    if (sampled.length > 1) return sampled
  }
  return yahooSparklineFromCloses(closes, maxPoints)
}

function geckoCoolingDown(): boolean {
  return Date.now() < geckoCooldownUntil
}

function markGeckoRateLimited(): void {
  geckoCooldownUntil = Date.now() + 90_000
}

async function fetchJson<T>(
  url: string,
  timeoutMs = 10000,
): Promise<{ data: T | null; status: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (res.status === 429) markGeckoRateLimited()
    if (!res.ok) return { data: null, status: res.status }
    const data = (await res.json()) as T
    // CoinGecko sometimes returns 200 with { status: { error_code: 429 } }
    const errCode = (data as { status?: { error_code?: number } })?.status?.error_code
    if (errCode === 429) {
      markGeckoRateLimited()
      return { data: null, status: 429 }
    }
    return { data, status: res.status }
  } catch {
    return { data: null, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

/** Prefer dedicated quote Worker, then same-origin /api/quote (when wired), then public CORS relays. */
function proxyCandidatesFor(url: string): string[] {
  const quoteProxyBase = (() => {
    try {
      const envUrl =
        typeof import.meta !== 'undefined' &&
        import.meta.env &&
        typeof import.meta.env.VITE_QUOTE_PROXY_URL === 'string'
          ? import.meta.env.VITE_QUOTE_PROXY_URL.trim()
          : ''
      if (envUrl) return envUrl.replace(/\/$/, '')
      // Default public Worker (deploy via npm run deploy:quote)
      return 'https://mydsp-quote.dave-perry.workers.dev'
    } catch {
      return 'https://mydsp-quote.dave-perry.workers.dev'
    }
  })()

  const sameOriginApi =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/api/quote`
      : ''

  const wrap = (target: string) => {
    const encoded = encodeURIComponent(target)
    const list = [
      `${quoteProxyBase}/quote?url=${encoded}`,
      // Same-origin when SPA+API Worker is configured (optional; fails fast if absent)
      ...(sameOriginApi ? [`${sameOriginApi}?url=${encoded}`] : []),
      `https://api.allorigins.win/raw?url=${encoded}`,
      `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
      `https://corsproxy.io/?${encoded}`,
    ]
    return list
  }

  const targets = [url]
  if (url.includes('query1.finance.yahoo.com')) {
    targets.push(url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com'))
  }

  const out: string[] = []
  for (const target of targets) {
    out.push(...wrap(target))
    out.push(target)
  }
  return out
}

/**
 * Race proxy + direct candidates; first valid JSON wins.
 * Avoids sequential stalls when one relay hangs or returns HTML.
 */
async function fetchViaProxies<T>(url: string, timeoutMs = 10000): Promise<T | null> {
  const candidates = proxyCandidatesFor(url)
  return new Promise((resolve) => {
    let remaining = candidates.length
    let settled = false
    if (remaining === 0) {
      resolve(null)
      return
    }
    for (const candidate of candidates) {
      void fetchJson<T>(candidate, timeoutMs).then(({ data }) => {
        if (settled) return
        if (data && typeof data === 'object') {
          settled = true
          resolve(data)
          return
        }
        remaining -= 1
        if (remaining === 0) resolve(null)
      })
    }
  })
}

/** Prefer direct CoinGecko (CORS *), fall back to proxies on failure / 429. */
async function fetchGeckoJson<T>(url: string, timeoutMs = 10000): Promise<T | null> {
  if (geckoCoolingDown()) {
    return fetchViaProxies<T>(url, timeoutMs)
  }
  const direct = await fetchJson<T>(url, timeoutMs)
  if (direct.data) return direct.data
  if (direct.status === 429 || direct.status === 0) {
    return fetchViaProxies<T>(url, timeoutMs)
  }
  return null
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
  const quotes = await fetchCryptoMarketQuotesGbp(
    symbols.map((symbol) => ({ symbol })),
    manualOverrides,
  )
  return quotes.map((q) => ({
    symbol: q.symbol,
    price: q.priceGbp,
    source:
      q.source === 'coingecko' || q.source === 'yahoo'
        ? 'coingecko'
        : q.source === 'default'
          ? 'default'
          : 'manual',
  }))
}

/** Raw market quote in the venue’s native currency (USD for US equities). */
export async function fetchEquityQuote(
  symbol: string,
  finnhubKey: string,
): Promise<number | null> {
  const q = await fetchEquityMarketQuote(symbol, finnhubKey)
  return q?.price ?? null
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
  await Promise.all(
    symbols.map(async (symbol) => {
      const raw = await fetchEquityQuote(symbol, finnhubKey)
      if (!raw || !(raw > 0)) return
      const sym = symbol.toUpperCase()
      out[sym] = equityNeedsUsdToGbp(sym) ? usdToGbp(raw, fx) : raw
    }),
  )
  return out
}

/** Convert a single native equity quote to GBP storage units. */
export function equityQuoteToGbp(
  symbol: string,
  nativePrice: number,
  rates: FxRates,
): number {
  if (!(nativePrice > 0)) return 0
  return equityNeedsUsdToGbp(symbol) ? usdToGbp(nativePrice, rates) : nativePrice
}

/**
 * Resolve CoinGecko id. Built-in map wins over a stored override so a bad
 * watchlist coingeckoId cannot poison known symbols (ADA, NIGHT, …).
 */
export function resolveGeckoId(symbol: string, override?: string): string | undefined {
  const sym = symbol.toUpperCase()
  if (GECKO_IDS[sym]) return GECKO_IDS[sym]
  if (override?.trim()) return override.trim()
  return geckoSearchCache.get(sym)
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
  if (geckoCoolingDown()) return undefined

  const data = await fetchGeckoJson<{
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

export interface EquityMarketQuoteNative {
  price: number
  previousClose: number
  changePct: number
  changeAbs: number
  sparkline: number[]
  extendedHours?: { session: 'pre' | 'post'; changePct: number }
  source: 'finnhub' | 'yahoo'
}

/** Full equity quote with timeframe % change + sparkline (native venue currency). */
export async function fetchEquityMarketQuote(
  symbol: string,
  finnhubKey: string,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<EquityMarketQuoteNative | null> {
  const sym = normalizeYahooEquitySymbol(symbol)
  const tf = timeframe

  if (finnhubKey.trim() && !sym.startsWith('^') && tf === '24H') {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(finnhubKey.trim())}`
    const { data } = await fetchJson<{ c?: number; d?: number; dp?: number; pc?: number }>(url)
    if (data?.c && data.c > 0) {
      const previousClose = data.pc && data.pc > 0 ? data.pc : data.c - (data.d ?? 0)
      let spark = await fetchYahooSparkline(sym, tf)
      if (spark.length < 2) {
        spark = await fetchFinnhubSparkline(sym, finnhubKey.trim(), tf)
      }
      // Prefer series % so badge matches sparkline (incl. weekends / thin sessions)
      const seriesPct = changePctFromSeries(spark)
      const sessionPct =
        data.dp ?? (previousClose > 0 ? ((data.c - previousClose) / previousClose) * 100 : 0)
      const changePct = spark.length >= 2 ? seriesPct : sessionPct
      const changeAbs =
        spark.length >= 2 && spark[0]! > 0
          ? data.c - spark[0]!
          : (data.d ?? data.c - previousClose)
      return {
        price: data.c,
        previousClose: spark.length >= 2 ? spark[0]! : previousClose,
        changeAbs,
        changePct,
        sparkline: spark,
        source: 'finnhub',
      }
    }
  }

  return fetchYahooChartQuote(sym, tf)
}

/** Finnhub candles → sparkline for the selected Markets window. */
async function fetchFinnhubSparkline(
  symbol: string,
  finnhubKey: string,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<number[]> {
  try {
    const params = yahooChartParamsForTimeframe(timeframe)
    const to = Math.floor(Date.now() / 1000)
    const from = to - Math.floor(params.windowMs / 1000)
    const resolution =
      timeframe === '24H' ? '5' : timeframe === '12M' ? 'D' : timeframe === '1M' ? '60' : '60'
    const url =
      `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}` +
      `&resolution=${resolution}&from=${from}&to=${to}&token=${encodeURIComponent(finnhubKey)}`
    const { data } = await fetchJson<{ c?: number[]; t?: number[]; s?: string }>(url)
    if (data?.s !== 'ok' || !Array.isArray(data.c)) return []
    if (Array.isArray(data.t) && data.t.length === data.c.length) {
      const points = data.t.map((t, i) => ({ t: t * 1000, price: data.c![i]! }))
      return downsampleIntradayPoints(points, params.maxPoints)
    }
    return takeLastSparklinePoints(
      data.c.filter((n): n is number => typeof n === 'number' && n > 0),
      params.maxPoints,
    )
  } catch {
    return []
  }
}

async function fetchYahooChartRaw(
  sym: string,
  range: string,
  interval: string,
): Promise<YahooChartResult | null> {
  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`
  const data = await fetchViaProxies<{
    chart?: { result?: YahooChartResult[] }
  }>(yahoo)
  return data?.chart?.result?.[0] ?? null
}

async function fetchYahooChartQuote(
  sym: string,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<EquityMarketQuoteNative | null> {
  const params = yahooChartParamsForTimeframe(timeframe)
  let result = await fetchYahooChartRaw(sym, params.range, params.interval)
  let spark = sparklineFromYahooResult(result ?? undefined, {
    windowMs: params.windowMs,
    maxPoints: params.maxPoints,
  })
  if (spark.length < 2 && params.fallbackRange) {
    result = (await fetchYahooChartRaw(sym, params.fallbackRange, params.interval)) ?? result
    spark = sparklineFromYahooResult(result ?? undefined, {
      windowMs: params.windowMs,
      maxPoints: params.maxPoints,
    })
  }

  const meta = result?.meta
  const price = meta?.regularMarketPrice
  if (!price || !(price > 0)) return null
  const sessionPrev = meta?.chartPreviousClose || meta?.previousClose || price
  const seriesPct = changePctFromSeries(spark)
  const sessionPct = sessionPrev > 0 ? ((price - sessionPrev) / sessionPrev) * 100 : 0
  const useSeries = spark.length >= 2
  const previousClose = useSeries ? spark[0]! : sessionPrev
  const changePct = useSeries ? seriesPct : sessionPct
  const changeAbs = price - previousClose

  let extendedHours: EquityMarketQuoteNative['extendedHours']
  if (meta?.postMarketPrice && meta.postMarketPrice > 0 && price > 0) {
    extendedHours = {
      session: 'post',
      changePct: ((meta.postMarketPrice - price) / price) * 100,
    }
  } else if (meta?.preMarketPrice && meta.preMarketPrice > 0 && sessionPrev > 0) {
    extendedHours = {
      session: 'pre',
      changePct: ((meta.preMarketPrice - sessionPrev) / sessionPrev) * 100,
    }
  }

  return {
    price,
    previousClose,
    changeAbs,
    changePct,
    sparkline: spark,
    extendedHours,
    source: 'yahoo',
  }
}

/** Normalize equity / index symbols for Yahoo (SPX → ^GSPC, etc.). */
export function normalizeYahooEquitySymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase()
  const aliases: Record<string, string> = {
    SPX: '^GSPC',
    GSPC: '^GSPC',
    'S&P500': '^GSPC',
    'S&P': '^GSPC',
    NDX: '^IXIC',
    IXIC: '^IXIC',
    COMP: '^IXIC',
    NASDAQ: '^IXIC',
    FTSE: '^FTSE',
    UKX: '^FTSE',
  }
  if (aliases[raw]) return aliases[raw]
  if (raw.startsWith('^')) return raw
  return raw
}

async function fetchYahooSparkline(
  symbol: string,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<number[]> {
  const params = yahooChartParamsForTimeframe(timeframe)
  let result = await fetchYahooChartRaw(symbol, params.range, params.interval)
  let spark = sparklineFromYahooResult(result ?? undefined, {
    windowMs: params.windowMs,
    maxPoints: params.maxPoints,
  })
  if (spark.length < 2 && params.fallbackRange) {
    result = await fetchYahooChartRaw(symbol, params.fallbackRange, params.interval)
    spark = sparklineFromYahooResult(result ?? undefined, {
      windowMs: params.windowMs,
      maxPoints: params.maxPoints,
    })
  }
  return spark
}

export interface CryptoMarketQuoteGbp {
  symbol: string
  priceGbp: number
  changePct: number
  sparkline?: number[]
  coingeckoId?: string
  source: 'coingecko' | 'yahoo' | 'coincap' | 'coinbase' | 'manual' | 'default'
}

/** Yahoo crypto chart ticker e.g. ADA → ADA-USD, NIGHT → NIGHT39064-USD */
export function yahooCryptoSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (YAHOO_CRYPTO_SYMBOLS[s]) return YAHOO_CRYPTO_SYMBOLS[s]
  if (s.includes('-')) return s
  return `${s}-USD`
}

/** CoinCap public API (CORS) — USD spot + 24h %. */
async function fetchCoinCapUsd(
  symbol: string,
): Promise<{ priceUsd: number; changePct: number } | null> {
  const id = COINCAP_IDS[symbol.toUpperCase()]
  if (!id) return null
  const { data } = await fetchJson<{
    data?: { priceUsd?: string; changePercent24Hr?: string }
  }>(`https://api.coincap.io/v2/assets/${encodeURIComponent(id)}`, 8000)
  const priceUsd = Number(data?.data?.priceUsd)
  if (!(priceUsd > 0)) return null
  return {
    priceUsd,
    changePct: Number(data?.data?.changePercent24Hr) || 0,
  }
}

/** Coinbase retail spot (CORS) — USD only. */
async function fetchCoinbaseUsd(symbol: string): Promise<number | null> {
  const s = symbol.toUpperCase()
  // Ambiguous / unsupported on Coinbase retail spot
  if (s === 'NIGHT') return null
  const { data } = await fetchJson<{ data?: { amount?: string } }>(
    `https://api.coinbase.com/v2/prices/${encodeURIComponent(s)}-USD/spot`,
    8000,
  )
  const price = Number(data?.data?.amount)
  return price > 0 ? price : null
}

/** Live crypto quote via Yahoo (USD) converted to GBP — sparkline matches timeframe %. */
export async function fetchCryptoYahooQuoteGbp(
  symbol: string,
  rates?: FxRates,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<CryptoMarketQuoteGbp | null> {
  const fx = rates ?? (await ensureFxRates())
  const ySym = yahooCryptoSymbol(symbol)
  const params = yahooChartParamsForTimeframe(timeframe)
  let result = await fetchYahooChartRaw(ySym, params.range, params.interval)
  let sparkUsd = sparklineFromYahooResult(result ?? undefined, {
    windowMs: params.windowMs,
    maxPoints: params.maxPoints,
  })
  if (sparkUsd.length < 2 && params.fallbackRange) {
    result = (await fetchYahooChartRaw(ySym, params.fallbackRange, params.interval)) ?? result
    sparkUsd = sparklineFromYahooResult(result ?? undefined, {
      windowMs: params.windowMs,
      maxPoints: params.maxPoints,
    })
  }

  const meta = result?.meta
  const priceUsd = meta?.regularMarketPrice
  if (!priceUsd || !(priceUsd > 0)) return null
  const priceGbp = usdToGbp(priceUsd, fx)
  const sparkline = sparkUsd.map((n) => usdToGbp(n, fx))
  const seriesPct = changePctFromSeries(sparkline)
  const prevUsd = meta?.chartPreviousClose || meta?.previousClose || priceUsd
  const prevGbp = usdToGbp(prevUsd, fx)
  const sessionPct = prevGbp > 0 ? ((priceGbp - prevGbp) / prevGbp) * 100 : 0
  const changePct = sparkline.length >= 2 ? seriesPct : sessionPct

  return {
    symbol: symbol.toUpperCase(),
    priceGbp,
    changePct,
    sparkline,
    source: 'yahoo',
  }
}

/**
 * Crypto quotes in GBP with timeframe % + sparkline when available.
 * CoinGecko first (built-in map wins), then Yahoo USD→GBP fallback (parallel).
 */
export async function fetchCryptoMarketQuotesGbp(
  items: Array<{ symbol: string; coingeckoId?: string }>,
  manualOverrides: Record<string, number> = {},
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<CryptoMarketQuoteGbp[]> {
  const unique = new Map<string, string | undefined>()
  for (const item of items) {
    const sym = item.symbol.toUpperCase()
    if (!unique.has(sym)) unique.set(sym, item.coingeckoId)
  }

  const resolvedIds = new Map<string, string>()
  await Promise.all(
    [...unique.entries()].map(async ([sym, override]) => {
      // Built-in map always wins for known tickers
      const id = GECKO_IDS[sym] || override?.trim() || (await lookupGeckoId(sym))
      if (id) resolvedIds.set(sym, id)
    }),
  )

  const idToSyms = new Map<string, string[]>()
  for (const [sym, id] of resolvedIds) {
    const list = idToSyms.get(id) ?? []
    list.push(sym)
    idToSyms.set(id, list)
  }

  const bySym = new Map<
    string,
    { price: number; changePct: number; coingeckoId?: string; source: 'coingecko' }
  >()

  if (idToSyms.size > 0 && !geckoCoolingDown()) {
    const ids = [...idToSyms.keys()].join(',')
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=gbp&include_24hr_change=true`
    const data = await fetchGeckoJson<Record<string, { gbp?: number; gbp_24h_change?: number }>>(url)
    if (data) {
      for (const [id, syms] of idToSyms) {
        const row = data[id]
        const p = row?.gbp
        if (p && p > 0) {
          for (const sym of syms) {
            bySym.set(sym, {
              price: p,
              // CoinGecko simple price only exposes 24h change — other windows filled from sparkline
              changePct: timeframe === '24H' ? (row?.gbp_24h_change ?? 0) : 0,
              coingeckoId: id,
              source: 'coingecko',
            })
          }
        }
      }
    }
  }

  const fx = await ensureFxRates()
  const missing = [...unique.keys()].filter((s) => !bySym.has(s))

  // Parallel multi-source fallback for CoinGecko misses (Yahoo + CoinCap + Coinbase)
  const fallbackBySym = new Map<string, CryptoMarketQuoteGbp>()
  await Promise.all(
    missing.map(async (symbol) => {
      try {
        const yahoo = await fetchCryptoYahooQuoteGbp(symbol, fx, timeframe)
        if (yahoo && yahoo.priceGbp > 0) {
          fallbackBySym.set(symbol, yahoo)
          return
        }
      } catch {
        /* try next */
      }

      try {
        const cap = await fetchCoinCapUsd(symbol)
        if (cap && cap.priceUsd > 0) {
          fallbackBySym.set(symbol, {
            symbol,
            priceGbp: usdToGbp(cap.priceUsd, fx),
            changePct: cap.changePct,
            coingeckoId: resolvedIds.get(symbol),
            source: 'coincap',
          })
          return
        }
      } catch {
        /* try next */
      }

      try {
        const cb = await fetchCoinbaseUsd(symbol)
        if (cb && cb > 0) {
          fallbackBySym.set(symbol, {
            symbol,
            priceGbp: usdToGbp(cb, fx),
            changePct: 0,
            coingeckoId: resolvedIds.get(symbol),
            source: 'coinbase',
          })
        }
      } catch {
        /* continue */
      }
    }),
  )

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

    const fallback = fallbackBySym.get(symbol)
    if (fallback && fallback.priceGbp > 0) {
      out.push({ ...fallback, coingeckoId: fallback.coingeckoId ?? resolvedIds.get(symbol) })
      continue
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

/** ECB daily FX via Frankfurter (CORS) — spot + spark for selected Markets window. */
export async function fetchFrankfurterFxQuote(
  base: string,
  quote: string,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<RateMarketQuote | null> {
  const b = base.toUpperCase()
  const q = quote.toUpperCase()
  if (b === q) {
    return {
      last: 1,
      previousClose: 1,
      changeAbs: 0,
      changePct: 0,
      sparkline: [1, 1],
      source: 'frankfurter',
    }
  }

  const days = frankfurterDaysForTimeframe(timeframe)
  const params = yahooChartParamsForTimeframe(timeframe)
  const end = new Date()
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - Math.max(days, 2))
  const startIso = start.toISOString().slice(0, 10)
  const endIso = end.toISOString().slice(0, 10)
  const path = `${startIso}..${endIso}?from=${encodeURIComponent(b)}&to=${encodeURIComponent(q)}`
  const urls = [
    `https://api.frankfurter.app/${path}`,
    `https://api.frankfurter.dev/v1/${path}`,
  ]

  let rates: Record<string, Record<string, number>> | undefined
  for (const url of urls) {
    const { data } = await fetchJson<{ rates?: Record<string, Record<string, number>> }>(url, 10000)
    if (data?.rates && Object.keys(data.rates).length > 0) {
      rates = data.rates
      break
    }
  }
  if (!rates) return null

  const dates = Object.keys(rates).sort()
  const closes = dates
    .map((d) => rates![d]?.[q])
    .filter((n): n is number => typeof n === 'number' && n > 0)
  const sparkline = takeLastSparklinePoints(closes, params.maxPoints)
  if (sparkline.length < 1) return null

  const last = sparkline[sparkline.length - 1]!
  const previousClose = sparkline[0]!
  const changeAbs = last - previousClose
  const changePct = previousClose > 0 ? (changeAbs / previousClose) * 100 : 0

  return {
    last,
    previousClose,
    changeAbs,
    changePct,
    sparkline: sparkline.length > 1 ? sparkline : [],
    source: 'frankfurter',
  }
}

async function fetchExchangerateApiSpot(
  base: string,
  quote: string,
): Promise<number | null> {
  try {
    const { data: fx } = await fetchJson<{ rates?: Record<string, number> }>(
      `https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(base.toUpperCase())}`,
    )
    const rate = fx?.rates?.[quote.toUpperCase()]
    return rate && rate > 0 ? rate : null
  } catch {
    return null
  }
}

export async function fetchFxPairQuote(
  base: string,
  quote: string,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<RateMarketQuote | null> {
  const ySym = yahooFxSymbol(base, quote)
  const params = yahooChartParamsForTimeframe(timeframe)
  let result = await fetchYahooChartRaw(ySym, params.range, params.interval)
  let yahooSpark = sparklineFromYahooResult(result ?? undefined, {
    windowMs: params.windowMs,
    maxPoints: params.maxPoints,
  })
  if (yahooSpark.length < 2 && params.fallbackRange) {
    result = (await fetchYahooChartRaw(ySym, params.fallbackRange, params.interval)) ?? result
    yahooSpark = sparklineFromYahooResult(result ?? undefined, {
      windowMs: params.windowMs,
      maxPoints: params.maxPoints,
    })
  }

  const meta = result?.meta
  const yahooPrice = meta?.regularMarketPrice

  if (yahooPrice && yahooPrice > 0 && yahooSpark.length > 1) {
    const previousClose = yahooSpark[0]!
    const changeAbs = yahooPrice - previousClose
    const changePct = changePctFromSeries([...yahooSpark.slice(0, -1), yahooPrice])
    return {
      last: yahooPrice,
      previousClose,
      changeAbs,
      changePct: Number.isFinite(changePct) ? changePct : changePctFromSeries(yahooSpark),
      sparkline: yahooSpark,
      source: 'yahoo',
    }
  }

  // Frankfurter: CORS daily series (fills spark + day-change when Yahoo proxies fail)
  const frank = await fetchFrankfurterFxQuote(base, quote, timeframe)
  const spot = await fetchExchangerateApiSpot(base, quote)

  if (yahooPrice && yahooPrice > 0) {
    const sessionPrev = meta?.chartPreviousClose || meta?.previousClose || yahooPrice
    let changeAbs = yahooPrice - sessionPrev
    let changePct = sessionPrev > 0 ? (changeAbs / sessionPrev) * 100 : 0
    let sparkline = yahooSpark
    let source = 'yahoo'
    if (sparkline.length < 2 && frank && frank.sparkline.length > 1) {
      sparkline = frank.sparkline
      changeAbs = frank.changeAbs
      changePct = frank.changePct
      source = 'yahoo+frankfurter'
    } else if (sparkline.length >= 2) {
      changePct = changePctFromSeries(sparkline)
      changeAbs = yahooPrice - sparkline[0]!
    }
    return {
      last: yahooPrice,
      previousClose: sparkline.length >= 2 ? sparkline[0]! : sessionPrev,
      changeAbs,
      changePct,
      sparkline,
      source,
    }
  }

  if (spot && spot > 0) {
    if (frank && frank.sparkline.length > 1) {
      const previousClose = frank.previousClose > 0 ? frank.previousClose : frank.last
      const changeAbs = spot - previousClose
      const changePct = previousClose > 0 ? (changeAbs / previousClose) * 100 : frank.changePct
      return {
        last: spot,
        previousClose,
        changeAbs,
        changePct,
        sparkline: frank.sparkline,
        source: 'exchangerate-api+frankfurter',
      }
    }
    return {
      last: spot,
      previousClose: frank?.last && frank.last > 0 ? frank.last : spot,
      changeAbs: frank && frank.last > 0 ? spot - frank.last : 0,
      changePct:
        frank && frank.last > 0 ? ((spot - frank.last) / frank.last) * 100 : 0,
      sparkline: frank?.sparkline ?? [],
      source: frank ? 'exchangerate-api+frankfurter' : 'exchangerate-api',
    }
  }

  if (frank && frank.last > 0) return frank
  return null
}

/** Index quote (S&P 500, Nasdaq, FTSE) in native points — not converted to GBP. */
export async function fetchIndexQuote(
  symbol: string,
  finnhubKey = '',
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<EquityMarketQuoteNative | null> {
  const sym = normalizeYahooEquitySymbol(symbol)
  const yahoo = await fetchYahooChartQuote(sym, timeframe)
  if (yahoo && yahoo.price > 0) {
    // If Yahoo returned a print but no spark, still try Finnhub candles when keyed
    if (yahoo.sparkline.length < 2 && finnhubKey.trim()) {
      const fhSym = finnhubIndexSymbol(sym)
      if (fhSym) {
        const spark = await fetchFinnhubSparkline(fhSym, finnhubKey.trim(), timeframe)
        if (spark.length > 1) {
          const changePct = changePctFromSeries(spark)
          const previousClose = spark[0]!
          return {
            ...yahoo,
            sparkline: spark,
            previousClose,
            changePct,
            changeAbs: yahoo.price - previousClose,
          }
        }
      }
    }
    return yahoo
  }

  // Finnhub index symbols (no caret): e.g. ^GSPC → SPX when mapped below
  if (finnhubKey.trim()) {
    const fhSym = finnhubIndexSymbol(sym)
    if (fhSym) {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fhSym)}&token=${encodeURIComponent(finnhubKey.trim())}`
      const { data } = await fetchJson<{ c?: number; d?: number; dp?: number; pc?: number }>(url)
      if (data?.c && data.c > 0) {
        const previousClose = data.pc && data.pc > 0 ? data.pc : data.c - (data.d ?? 0)
        const changeAbs = data.d ?? data.c - previousClose
        const changePct =
          data.dp ?? (previousClose > 0 ? ((data.c - previousClose) / previousClose) * 100 : 0)
        let spark = await fetchYahooSparkline(sym, timeframe)
        if (spark.length < 2) spark = await fetchFinnhubSparkline(fhSym, finnhubKey.trim(), timeframe)
        const seriesPct = changePctFromSeries(spark)
        const useSeries = spark.length >= 2
        return {
          price: data.c,
          previousClose: useSeries ? spark[0]! : previousClose,
          changeAbs: useSeries ? data.c - spark[0]! : changeAbs,
          changePct: useSeries ? seriesPct : changePct,
          sparkline: spark,
          source: 'finnhub',
        }
      }
    }
  }
  return null
}

function finnhubIndexSymbol(yahooSym: string): string | null {
  const map: Record<string, string> = {
    '^GSPC': 'SPX',
    '^IXIC': 'IXIC',
    '^FTSE': 'UKX',
  }
  return map[yahooSym.toUpperCase()] ?? null
}

/** Crypto cross e.g. ADA/BTC via CoinGecko (quote in BTC) + timeframe sparkline. */
export async function fetchCryptoCrossQuote(
  base: string,
  quote: string,
  baseGeckoId?: string,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<RateMarketQuote | null> {
  const baseId = GECKO_IDS[base.toUpperCase()] || baseGeckoId?.trim() || (await lookupGeckoId(base))
  const quoteId = GECKO_IDS[quote.toUpperCase()] || (await lookupGeckoId(quote))
  if (!baseId) {
    try {
      const [baseQ, quoteQ] = await Promise.all([
        fetchCryptoYahooQuoteGbp(base, undefined, timeframe),
        fetchCryptoYahooQuoteGbp(quote, undefined, timeframe),
      ])
      if (baseQ && quoteQ && baseQ.priceGbp > 0 && quoteQ.priceGbp > 0) {
        const last = baseQ.priceGbp / quoteQ.priceGbp
        const changePct = (baseQ.changePct ?? 0) - (quoteQ.changePct ?? 0)
        const previousClose = last / (1 + changePct / 100)
        const spark =
          baseQ.sparkline && quoteQ.sparkline
            ? takeLastSparklinePoints(
                baseQ.sparkline
                  .map((b, i) => {
                    const q = quoteQ.sparkline![Math.min(i, quoteQ.sparkline!.length - 1)]
                    return q > 0 ? b / q : 0
                  })
                  .filter((n) => n > 0),
                SPARKLINE_MAX_POINTS,
              )
            : []
        return {
          last,
          previousClose,
          changeAbs: last - previousClose,
          changePct,
          sparkline: spark,
          source: 'yahoo-derived',
        }
      }
    } catch {
      /* fall through */
    }
    return null
  }

  const vs = quote.toLowerCase()
  const supportedVs = new Set([
    'btc', 'eth', 'ltc', 'bch', 'bnb', 'eos', 'xrp', 'xlm', 'link', 'dot', 'yfi',
    'usd', 'eur', 'gbp', 'aed', 'ars', 'aud', 'bdt', 'bhd', 'bmd', 'brl', 'cad',
    'chf', 'clp', 'cny', 'czk', 'dkk', 'hkd', 'huf', 'idr', 'ils', 'inr', 'jpy',
    'krw', 'kwd', 'lkr', 'mmk', 'mxn', 'myr', 'ngn', 'nok', 'nzd', 'php', 'pkr',
    'pln', 'rub', 'sar', 'sek', 'sgd', 'thb', 'try', 'twd', 'uah', 'vef', 'vnd',
    'zar', 'xdr', 'xag', 'xau', 'bits', 'sats',
  ])

  if (!supportedVs.has(vs)) {
    if (!quoteId) return null
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${baseId},${quoteId}&vs_currencies=gbp&include_24hr_change=true`
    const data = await fetchGeckoJson<Record<string, { gbp?: number; gbp_24h_change?: number }>>(url)
    const baseGbp = data?.[baseId]?.gbp
    const quoteGbp = data?.[quoteId]?.gbp
    if (!(baseGbp && baseGbp > 0 && quoteGbp && quoteGbp > 0)) return null
    const last = baseGbp / quoteGbp
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
  const data = await fetchGeckoJson<Record<string, Record<string, number | undefined>>>(url)
  const row = data?.[baseId]
  const last = row?.[vs]
  if (!(typeof last === 'number' && last > 0)) return null
  const changePctSpot = row?.[`${vs}_24h_change`] ?? 0
  let previousClose = last / (1 + changePctSpot / 100)

  const tfParams = yahooChartParamsForTimeframe(timeframe)
  const geckoDays = geckoDaysForTimeframe(timeframe)
  let sparkline: number[] = []
  if (!geckoCoolingDown()) {
    try {
      const chartUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(baseId)}/market_chart?vs_currency=${encodeURIComponent(vs)}&days=${geckoDays}`
      const chart = await fetchGeckoJson<{ prices?: Array<[number, number]> }>(chartUrl, 12000)
      sparkline = downsampleGeckoPricesIntraday(
        chart?.prices,
        tfParams.maxPoints,
        tfParams.windowMs,
      )
    } catch {
      /* optional */
    }
  }

  let changePct = changePctSpot
  if (sparkline.length >= 2) {
    changePct = changePctFromSeries(sparkline)
    previousClose = sparkline[0]!
  } else if (timeframe !== '24H') {
    changePct = 0
    previousClose = last
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

/**
 * Optional GBP sparkline for a single crypto (selected Markets timeframe).
 * Tries Yahoo and CoinGecko (whichever returns first with enough points).
 */
export async function fetchCryptoGbpSparkline(
  symbol: string,
  coingeckoId?: string,
  timeframe: MarketTimeframe = DEFAULT_MARKET_TF,
): Promise<number[]> {
  const params = yahooChartParamsForTimeframe(timeframe)
  const yahooAttempt = (async () => {
    try {
      const yahoo = await fetchCryptoYahooQuoteGbp(symbol, undefined, timeframe)
      if (yahoo?.sparkline && yahoo.sparkline.length > 1) return yahoo.sparkline
    } catch {
      /* ignore */
    }
    return [] as number[]
  })()

  const geckoAttempt = (async () => {
    try {
      if (geckoCoolingDown()) return [] as number[]
      const id =
        GECKO_IDS[symbol.toUpperCase()] || coingeckoId?.trim() || (await lookupGeckoId(symbol))
      if (!id) return [] as number[]
      const days = geckoDaysForTimeframe(timeframe)
      const chartUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=gbp&days=${days}`
      const chart = await fetchGeckoJson<{ prices?: Array<[number, number]> }>(chartUrl, 12000)
      return downsampleGeckoPricesIntraday(chart?.prices, params.maxPoints, params.windowMs)
    } catch {
      return [] as number[]
    }
  })()

  const [yahoo, gecko] = await Promise.all([yahooAttempt, geckoAttempt])
  if (yahoo.length > 1) return yahoo
  if (gecko.length > 1) return gecko
  return []
}

/** @deprecated use fetchYahooSparkline — kept for callers expecting intraday */
export async function fetchEquitySparkline(symbol: string, _days = SPARKLINE_HOURS): Promise<number[]> {
  return fetchYahooSparkline(normalizeYahooEquitySymbol(symbol))
}
