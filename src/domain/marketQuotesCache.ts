/** Merge live Markets quotes with last-good cache so rows never blank out. */

import type { MarketQuote } from '../domain/markets'

/** Sources that often return spot-only (no day-change / no sparkline). */
const DEGRADED_SOURCES = new Set([
  'exchangerate-api',
  'coinbase',
  'manual',
  'default',
  'portfolio',
  'none',
  'error',
  'invalid',
])

function hasSpark(q: MarketQuote | undefined): boolean {
  return Boolean(q && q.sparkline.length > 1)
}

function hasMeaningfulChange(q: MarketQuote | undefined): boolean {
  if (!q) return false
  return Math.abs(q.changePct) > 0.0001 || Math.abs(q.changeAbs) > 0.0000001
}

function isDegraded(q: MarketQuote): boolean {
  const src = (q.source || '').toLowerCase()
  if (src.startsWith('stale:')) return false
  return DEGRADED_SOURCES.has(src)
}

/**
 * Prefer a fresh live print; keep prior sparkline / day-change when live is
 * spot-only or otherwise degraded so the UI does not lose 7-day charts.
 */
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
      let merged: MarketQuote = { ...live }

      // Keep a good prior sparkline when live has none (CoinGecko/FX spot/etc.)
      if (!hasSpark(merged) && hasSpark(prior)) {
        merged = { ...merged, sparkline: [...prior!.sparkline] }
      }

      // Keep prior day-change when live is spot-only / degraded and prior had movement
      if (!hasMeaningfulChange(merged) && hasMeaningfulChange(prior) && isDegraded(live)) {
        merged = {
          ...merged,
          changeAbs: prior!.changeAbs,
          changePct: prior!.changePct,
        }
      }

      out.set(id, merged)
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
