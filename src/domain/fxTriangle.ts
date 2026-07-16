/** FX cross-rate triangle consistency check for Markets. */

import { normalizeMarketSymbol, parseRatePair } from './markets'

/** Default relative discrepancy (%) before warning. */
export const DEFAULT_FX_TRIANGLE_THRESHOLD_PCT = 0.5

export type FxTriangleHit = {
  /** Three pairs involved (canonical BASE/QUOTE form). */
  pairs: [string, string, string]
  /** Product-implied rate for the third pair. */
  implied: number
  /** Observed quote for that pair. */
  actual: number
  /** |implied − actual| / actual × 100 */
  discrepancyPct: number
}

type Edge = { base: string; quote: string; rate: number; symbol: string }

function pairKey(base: string, quote: string): string {
  return `${base}/${quote}`
}

/**
 * Build directed rates from FX quotes (includes inverses).
 * `last` is quote units per 1 base (e.g. GBP/USD = 1.27 means 1 GBP → 1.27 USD).
 */
export function buildFxRateMap(
  quotes: Iterable<{ symbol: string; last: number }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const q of quotes) {
    if (!(q.last > 0)) continue
    const pair = parseRatePair(q.symbol)
    if (!pair) continue
    const base = pair.base.toUpperCase()
    const quote = pair.quote.toUpperCase()
    if (base === quote) continue
    map.set(pairKey(base, quote), q.last)
    map.set(pairKey(quote, base), 1 / q.last)
  }
  return map
}

/**
 * When GBP/USD, GBP/EUR, EUR/USD (or any similar triangle) are present,
 * warn if the cross product disagrees beyond `thresholdPct`.
 */
export function checkFxTriangles(
  quotes: Iterable<{ symbol: string; last: number }>,
  thresholdPct: number = DEFAULT_FX_TRIANGLE_THRESHOLD_PCT,
): FxTriangleHit[] {
  const rates = buildFxRateMap(quotes)
  const edges: Edge[] = []
  for (const [symbol, rate] of rates) {
    const pair = parseRatePair(symbol)
    if (!pair || !(rate > 0)) continue
    // Only keep "forward" edges we can use once per undirected pair later
    edges.push({ base: pair.base, quote: pair.quote, rate, symbol: normalizeMarketSymbol(symbol) })
  }

  const currencies = [...new Set(edges.flatMap((e) => [e.base, e.quote]))].sort()
  const hits: FxTriangleHit[] = []
  const seen = new Set<string>()

  for (let i = 0; i < currencies.length; i++) {
    for (let j = i + 1; j < currencies.length; j++) {
      for (let k = j + 1; k < currencies.length; k++) {
        const A = currencies[i]!
        const B = currencies[j]!
        const C = currencies[k]!
        const ab = rates.get(pairKey(A, B))
        const bc = rates.get(pairKey(B, C))
        const ac = rates.get(pairKey(A, C))
        if (ab == null || bc == null || ac == null) continue
        if (!(ab > 0) || !(bc > 0) || !(ac > 0)) continue

        const implied = ab * bc
        const discrepancyPct = (Math.abs(implied - ac) / ac) * 100
        if (!(discrepancyPct > thresholdPct)) continue

        const triKey = [A, B, C].sort().join('|')
        if (seen.has(triKey)) continue
        seen.add(triKey)

        hits.push({
          pairs: [pairKey(A, B), pairKey(B, C), pairKey(A, C)],
          implied,
          actual: ac,
          discrepancyPct,
        })
      }
    }
  }

  return hits.sort((a, b) => b.discrepancyPct - a.discrepancyPct)
}

/** One-line status for Markets banner. */
export function formatFxTriangleWarning(hit: FxTriangleHit): string {
  const pct = hit.discrepancyPct.toFixed(hit.discrepancyPct >= 10 ? 0 : 2)
  return `${hit.pairs[0]} × ${hit.pairs[1]} ≠ ${hit.pairs[2]} (~${pct}% off)`
}

function formatSuggestedRate(rate: number): string {
  return rate.toLocaleString('en-GB', {
    minimumFractionDigits: rate >= 10 ? 2 : 4,
    maximumFractionDigits: rate >= 10 ? 4 : 6,
  })
}

/** Suggested replacement for the observed cross in the warning. */
export function formatFxTriangleSuggestedRate(hit: FxTriangleHit): string {
  return `${hit.pairs[2]} ${formatSuggestedRate(hit.implied)}`
}
