/** Offline-first Markets: when offline or all quotes are stale → Cached mode. */

import type { MarketQuote } from './markets'

const STALE_MS = 4 * 60 * 60 * 1000

export function isQuoteStaleForCachedMode(
  q: MarketQuote | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!q) return true
  const src = (q.source || '').toLowerCase()
  if (src.startsWith('stale:') || src === 'portfolio' || src === 'fx-cache') {
    return true
  }
  try {
    const t = new Date(q.updatedAt).getTime()
    if (Number.isFinite(t) && nowMs - t > STALE_MS) return true
  } catch {
    return true
  }
  return false
}

/** True when offline, or every priced quote is stale (or there are no priced quotes). */
export function shouldShowCachedMode(
  online: boolean,
  quotes: Iterable<MarketQuote>,
  nowMs: number = Date.now(),
): boolean {
  if (!online) return true
  const priced = [...quotes].filter((q) => q.last > 0)
  if (priced.length === 0) return false
  return priced.every((q) => isQuoteStaleForCachedMode(q, nowMs))
}
