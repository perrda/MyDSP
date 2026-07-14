/** Refresh Markets watchlist quotes (crypto via CoinGecko, equities via Finnhub/Yahoo). */

import type { MarketQuote, MarketTicker } from '../domain/markets'
import { equityNeedsUsdToGbp } from '../domain/equityCurrency'
import { ensureFxRates, usdToGbp } from './fx'
import {
  fetchCryptoMarketQuotesGbp,
  fetchEquityMarketQuote,
} from './prices'

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

  if (cryptos.length > 0) {
    const quotes = await fetchCryptoMarketQuotesGbp(
      cryptos.map((t) => ({ symbol: t.symbol, coingeckoId: t.coingeckoId })),
      opts?.manualCryptoPrices ?? {},
    )
    const bySym = new Map(quotes.map((q) => [q.symbol, q]))
    for (const t of cryptos) {
      const q = bySym.get(t.symbol)
      const priceGbp = q?.priceGbp ?? 0
      const changePct = q?.changePct ?? 0
      const changeAbsGbp = priceGbp * (changePct / 100)
      out.set(t.id, {
        symbol: t.symbol,
        kind: 'crypto',
        priceGbp,
        changeAbsGbp,
        changePct,
        sparkline: [],
        source: q?.source ?? 'manual',
        updatedAt: now,
      })
    }
  }

  await Promise.all(
    equities.map(async (t) => {
      try {
        const native = await fetchEquityMarketQuote(t.symbol, finnhubKey)
        if (!native || !(native.price > 0)) {
          out.set(t.id, {
            symbol: t.symbol,
            kind: 'equity',
            priceGbp: 0,
            changeAbsGbp: 0,
            changePct: 0,
            sparkline: [],
            source: 'none',
            updatedAt: now,
          })
          return
        }
        const toGbp = (n: number) =>
          equityNeedsUsdToGbp(t.symbol) ? usdToGbp(n, fx) : n
        const priceGbp = toGbp(native.price)
        const prevGbp = toGbp(native.previousClose)
        const changeAbsGbp = priceGbp - prevGbp
        const changePct =
          prevGbp > 0 ? (changeAbsGbp / prevGbp) * 100 : native.changePct
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'equity',
          priceGbp,
          changeAbsGbp,
          changePct,
          sparkline: native.sparkline.map(toGbp),
          extendedHours: native.extendedHours,
          source: native.source,
          updatedAt: now,
        })
      } catch {
        out.set(t.id, {
          symbol: t.symbol,
          kind: 'equity',
          priceGbp: 0,
          changeAbsGbp: 0,
          changePct: 0,
          sparkline: [],
          source: 'error',
          updatedAt: now,
        })
      }
    }),
  )

  return out
}
