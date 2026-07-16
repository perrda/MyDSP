/** Refresh Markets watchlist quotes (crypto, equities, indices, FX, crosses). */

import {
  parseRatePair,
  rateDecimals,
  type MarketQuote,
  type MarketTicker,
} from '../domain/markets'
import { mergeMarketQuotes } from '../domain/marketQuotesCache'
import { equityNeedsUsdToGbp } from '../domain/equityCurrency'
import {
  listMarketTickers,
  loadMarketQuotesCache,
  saveMarketQuotesCache,
  setMarketsLastRefresh,
  updateMarketTicker,
} from '../storage/marketsStore'
import { ensureFxRates, usdToGbp } from './fx'
import {
  fetchCommodityMarketQuote,
  fetchCryptoCrossQuote,
  fetchCryptoGbpSparkline,
  fetchCryptoMarketQuotesGbp,
  fetchEquityMarketQuote,
  fetchFrankfurterFxQuote,
  fetchFxPairQuote,
  fetchIndexQuote,
  type CryptoMarketQuoteGbp,
} from './prices'
import { recordMarketsRefreshHealth } from './marketsProviderHealth'

const SPARKLINE_CONCURRENCY = 5

function emptyQuote(
  t: MarketTicker,
  now: string,
  unit: string,
  decimals: number,
  source: string,
): MarketQuote {
  return {
    symbol: t.symbol,
    kind: t.kind,
    last: 0,
    changeAbs: 0,
    changePct: 0,
    sparkline: [],
    unit,
    decimals,
    source,
    updatedAt: now,
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      await fn(items[i])
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1))
  await Promise.all(Array.from({ length: n }, () => worker()))
}

function cryptoDecimals(last: number): number {
  if (!(last > 0)) return 2
  if (last < 0.01) return 6
  if (last < 1) return 4
  return 2
}

function persistResolvedGeckoIds(
  tickers: MarketTicker[],
  bySym: Map<string, CryptoMarketQuoteGbp>,
): void {
  for (const t of tickers) {
    if (t.kind !== 'crypto') continue
    const q = bySym.get(t.symbol.toUpperCase())
    if (!q?.coingeckoId) continue
    if (t.coingeckoId === q.coingeckoId) continue
    try {
      updateMarketTicker(t.id, { coingeckoId: q.coingeckoId })
    } catch {
      /* watchlist may have changed mid-refresh */
    }
  }
}

export async function refreshMarketQuotes(
  tickers: MarketTicker[],
  opts?: { finnhubKey?: string; manualCryptoPrices?: Record<string, number> },
): Promise<Map<string, MarketQuote>> {
  const out = new Map<string, MarketQuote>()
  const now = new Date().toISOString()
  const finnhubKey = opts?.finnhubKey ?? ''
  const fx = await ensureFxRates()

  const cryptos = tickers.filter((t) => t.kind === 'crypto')
  const equities = tickers.filter((t) => t.kind === 'equity')
  const commodities = tickers.filter((t) => t.kind === 'commodity')
  const indices = tickers.filter((t) => t.kind === 'index')
  const fiatFx = tickers.filter((t) => t.kind === 'fx')
  const crosses = tickers.filter((t) => t.kind === 'cross')

  if (cryptos.length > 0) {
    const quotes = await fetchCryptoMarketQuotesGbp(
      cryptos.map((t) => ({ symbol: t.symbol, coingeckoId: t.coingeckoId })),
      opts?.manualCryptoPrices ?? {},
    )
    const bySym = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]))
    persistResolvedGeckoIds(cryptos, bySym)

    for (const t of cryptos) {
      const q = bySym.get(t.symbol.toUpperCase())
      const last = q?.priceGbp ?? 0
      const changePct = q?.changePct ?? 0
      const changeAbs = last * (changePct / 100)
      out.set(t.id, {
        symbol: t.symbol,
        kind: 'crypto',
        last,
        changeAbs,
        changePct,
        sparkline: q?.sparkline && q.sparkline.length > 1 ? q.sparkline : [],
        unit: 'GBP',
        decimals: cryptoDecimals(last),
        source: q?.source ?? 'manual',
        updatedAt: now,
      })
    }

    // Fill missing 24h sparklines via Yahoo-first helper (avoids CoinGecko chart spam)
    await mapPool(
      cryptos.filter((t) => (out.get(t.id)?.last ?? 0) > 0 && (out.get(t.id)?.sparkline.length ?? 0) < 2),
      SPARKLINE_CONCURRENCY,
      async (t) => {
        const existing = out.get(t.id)
        if (!existing) return
        try {
          const geckoId =
            bySym.get(t.symbol.toUpperCase())?.coingeckoId ?? t.coingeckoId
          const sparkline = await fetchCryptoGbpSparkline(t.symbol, geckoId)
          if (sparkline.length > 1) {
            out.set(t.id, { ...existing, sparkline })
          }
        } catch {
          /* optional */
        }
      },
    )
  }

  await Promise.all(
    equities.map(async (t) => {
      try {
        const native = await fetchEquityMarketQuote(t.symbol, finnhubKey)
        if (!native || !(native.price > 0)) {
          out.set(t.id, emptyQuote(t, now, 'GBP', 2, 'none'))
          return
        }
        const toGbp = (n: number) =>
          equityNeedsUsdToGbp(t.symbol) ? usdToGbp(n, fx) : n
        const last = toGbp(native.price)
        const prev = toGbp(native.previousClose)
        const changeAbs = last - prev
        const changePct = prev > 0 ? (changeAbs / prev) * 100 : native.changePct
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'equity',
          last,
          changeAbs,
          changePct,
          sparkline: native.sparkline.map(toGbp),
          unit: 'GBP',
          decimals: 2,
          extendedHours: native.extendedHours,
          source: native.source,
          updatedAt: now,
        })
      } catch {
        out.set(t.id, emptyQuote(t, now, 'GBP', 2, 'error'))
      }
    }),
  )

  // Commodities — Yahoo futures/spot (USD) → GBP via FX (same path as US equities)
  await Promise.all(
    commodities.map(async (t) => {
      try {
        const native = await fetchCommodityMarketQuote(t.symbol)
        if (!native || !(native.price > 0)) {
          out.set(t.id, emptyQuote(t, now, 'GBP', 2, 'none'))
          return
        }
        const last = usdToGbp(native.price, fx)
        const prev = usdToGbp(native.previousClose, fx)
        const changeAbs = last - prev
        const changePct = prev > 0 ? (changeAbs / prev) * 100 : native.changePct
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'commodity',
          last,
          changeAbs,
          changePct,
          sparkline: native.sparkline.map((n) => usdToGbp(n, fx)),
          unit: 'GBP',
          decimals: last >= 100 ? 2 : last >= 1 ? 2 : 4,
          source: native.source,
          updatedAt: now,
        })
      } catch {
        out.set(t.id, emptyQuote(t, now, 'GBP', 2, 'error'))
      }
    }),
  )

  await Promise.all(
    indices.map(async (t) => {
      try {
        const q = await fetchIndexQuote(t.symbol, finnhubKey)
        if (!q || !(q.price > 0)) {
          out.set(t.id, emptyQuote(t, now, 'pts', 2, 'none'))
          return
        }
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'index',
          last: q.price,
          changeAbs: q.changeAbs,
          changePct: q.changePct,
          sparkline: q.sparkline,
          unit: 'pts',
          decimals: 2,
          source: q.source,
          updatedAt: now,
        })
      } catch {
        out.set(t.id, emptyQuote(t, now, 'pts', 2, 'error'))
      }
    }),
  )

  await Promise.all(
    fiatFx.map(async (t) => {
      const pair = parseRatePair(t.symbol)
      if (!pair) {
        out.set(t.id, emptyQuote(t, now, '—', 4, 'invalid'))
        return
      }
      try {
        const q = await fetchFxPairQuote(pair.base, pair.quote)
        if (!q) {
          out.set(t.id, emptyQuote(t, now, pair.quote, rateDecimals(pair.quote), 'none'))
          return
        }
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'fx',
          last: q.last,
          changeAbs: q.changeAbs,
          changePct: q.changePct,
          sparkline: q.sparkline,
          unit: pair.quote,
          decimals: rateDecimals(pair.quote),
          source: q.source,
          updatedAt: now,
        })
      } catch {
        out.set(t.id, emptyQuote(t, now, pair.quote, rateDecimals(pair.quote), 'error'))
      }
    }),
  )

  // Fill missing FX 24h sparklines via Frankfurter (same idea as crypto Yahoo fill)
  await mapPool(
    fiatFx.filter((t) => (out.get(t.id)?.last ?? 0) > 0 && (out.get(t.id)?.sparkline.length ?? 0) < 2),
    SPARKLINE_CONCURRENCY,
    async (t) => {
      const existing = out.get(t.id)
      const pair = parseRatePair(t.symbol)
      if (!existing || !pair) return
      try {
        const frank = await fetchFrankfurterFxQuote(pair.base, pair.quote)
        if (!frank || frank.sparkline.length < 2) return
        const previousClose = frank.previousClose > 0 ? frank.previousClose : frank.last
        const changeAbs =
          Math.abs(existing.changePct) > 0.0001
            ? existing.changeAbs
            : existing.last - previousClose
        const changePct =
          Math.abs(existing.changePct) > 0.0001
            ? existing.changePct
            : previousClose > 0
              ? (changeAbs / previousClose) * 100
              : frank.changePct
        out.set(t.id, {
          ...existing,
          sparkline: frank.sparkline,
          changeAbs,
          changePct,
          source: existing.source.includes('frankfurter')
            ? existing.source
            : `${existing.source}+frankfurter`,
        })
      } catch {
        /* optional */
      }
    },
  )

  await Promise.all(
    crosses.map(async (t) => {
      const pair = parseRatePair(t.symbol)
      if (!pair) {
        out.set(t.id, emptyQuote(t, now, '—', 8, 'invalid'))
        return
      }
      try {
        const q = await fetchCryptoCrossQuote(pair.base, pair.quote, t.coingeckoId)
        if (!q) {
          out.set(t.id, emptyQuote(t, now, pair.quote, rateDecimals(pair.quote), 'none'))
          return
        }
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'cross',
          last: q.last,
          changeAbs: q.changeAbs,
          changePct: q.changePct,
          sparkline: q.sparkline,
          unit: pair.quote,
          decimals: rateDecimals(pair.quote),
          source: q.source,
          updatedAt: now,
        })
      } catch {
        out.set(t.id, emptyQuote(t, now, pair.quote, rateDecimals(pair.quote), 'error'))
      }
    }),
  )

  recordMarketsRefreshHealth(out.values())
  return out
}

/** Light prefetch for nav hover/focus — warms quote cache without blocking UI. */
let prefetchInFlight: Promise<void> | null = null

export function prefetchMarketQuotes(opts?: {
  finnhubKey?: string
  manualCryptoPrices?: Record<string, number>
}): void {
  if (prefetchInFlight) return
  const list = listMarketTickers()
  if (list.length === 0) return
  prefetchInFlight = (async () => {
    try {
      const next = await refreshMarketQuotes(list, opts)
      const merged = mergeMarketQuotes(loadMarketQuotesCache(), next)
      saveMarketQuotesCache(merged)
      setMarketsLastRefresh(new Date().toISOString())
    } catch {
      /* best-effort */
    } finally {
      prefetchInFlight = null
    }
  })()
}
