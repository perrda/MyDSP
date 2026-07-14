/** Refresh Markets watchlist quotes (crypto, equities, FX, crypto crosses). */

import {
  parseRatePair,
  rateDecimals,
  type MarketQuote,
  type MarketTicker,
} from '../domain/markets'
import { equityNeedsUsdToGbp } from '../domain/equityCurrency'
import { ensureFxRates, usdToGbp } from './fx'
import {
  fetchCryptoCrossQuote,
  fetchCryptoGbpSparkline,
  fetchCryptoMarketQuotesGbp,
  fetchEquityMarketQuote,
  fetchFxPairQuote,
} from './prices'

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
  const fiatFx = tickers.filter((t) => t.kind === 'fx')
  const crosses = tickers.filter((t) => t.kind === 'cross')

  if (cryptos.length > 0) {
    const quotes = await fetchCryptoMarketQuotesGbp(
      cryptos.map((t) => ({ symbol: t.symbol, coingeckoId: t.coingeckoId })),
      opts?.manualCryptoPrices ?? {},
    )
    const bySym = new Map(quotes.map((q) => [q.symbol, q]))

    await Promise.all(
      cryptos.map(async (t) => {
        const q = bySym.get(t.symbol)
        const last = q?.priceGbp ?? 0
        const changePct = q?.changePct ?? 0
        const changeAbs = last * (changePct / 100)
        let sparkline: number[] = []
        try {
          sparkline = await fetchCryptoGbpSparkline(t.symbol, t.coingeckoId)
        } catch {
          /* optional */
        }
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'crypto',
          last,
          changeAbs,
          changePct,
          sparkline,
          unit: 'GBP',
          decimals: 2,
          source: q?.source ?? 'manual',
          updatedAt: now,
        })
      }),
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

  return out
}
