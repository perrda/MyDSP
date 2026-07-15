/** Merge live Markets quotes with last-good cache so rows never blank out. */

import type { MarketQuote } from '../domain/markets'

/** Prefer a fresh live print; otherwise keep the previous good value (marked stale). */
export function mergeMarketQuotes(
  previous: Map<string, MarketQuote>,
  next: Map<string, MarketQuote>,
): Map<string, MarketQuote> {
  const out = new Map<string, MarketQuote>()
  const ids = new Set([...previous.keys(), ...next.keys()])

  for (const id of ids) {
    const live = next.get(id)
    const prior = previous.get(id)

    if (live && live.last > 0) {
      out.set(id, live)
      continue
    }

    if (prior && prior.last > 0) {
      const alreadyStale = prior.source.startsWith('stale:') || prior.source === 'portfolio'
      out.set(id, {
        ...prior,
        source: alreadyStale ? prior.source : `stale:${prior.source || 'cache'}`,
      })
      continue
    }

    if (live) out.set(id, live)
  }

  return out
}

/** Serialize only quotes that have a usable last print. */
export function quotesMapToRecord(map: Map<string, MarketQuote>): Record<string, MarketQuote> {
  const out: Record<string, MarketQuote> = {}
  for (const [id, q] of map) {
    if (q.last > 0) out[id] = q
  }
  return out
}

export function quotesRecordToMap(raw: unknown): Map<string, MarketQuote> {
  const out = new Map<string, MarketQuote>()
  if (!raw || typeof raw !== 'object') return out
  for (const [id, q] of Object.entries(raw as Record<string, MarketQuote>)) {
    if (!q || typeof q !== 'object') continue
    if (!(typeof q.last === 'number' && q.last > 0)) continue
    if (typeof q.symbol !== 'string' || typeof q.kind !== 'string') continue
    out.set(id, {
      symbol: q.symbol,
      kind: q.kind,
      last: q.last,
      changeAbs: typeof q.changeAbs === 'number' ? q.changeAbs : 0,
      changePct: typeof q.changePct === 'number' ? q.changePct : 0,
      sparkline: Array.isArray(q.sparkline)
        ? q.sparkline.filter((n): n is number => typeof n === 'number' && n > 0)
        : [],
      unit: typeof q.unit === 'string' ? q.unit : '',
      decimals: typeof q.decimals === 'number' ? q.decimals : 2,
      extendedHours: q.extendedHours,
      source: typeof q.source === 'string' ? q.source : 'cache',
      updatedAt: typeof q.updatedAt === 'string' ? q.updatedAt : new Date().toISOString(),
    })
  }
  return out
}
