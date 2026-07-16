/** Quote-cache freshness SLA — synced prints older than this look stale. */

import type { MarketQuote } from './markets'
import { isSyncedRemoteQuote } from './marketQuotesSync'

/** Synced / cached quotes older than 30 minutes get an SLA warning chip. */
export const QUOTE_FRESHNESS_SLA_MS = 30 * 60 * 1000

export function quoteAgeMs(q: MarketQuote | undefined, nowMs = Date.now()): number | null {
  if (!q?.updatedAt) return null
  const t = Date.parse(q.updatedAt)
  if (!Number.isFinite(t)) return null
  return Math.max(0, nowMs - t)
}

export function isPastQuoteFreshnessSla(
  q: MarketQuote | undefined,
  nowMs = Date.now(),
): boolean {
  const age = quoteAgeMs(q, nowMs)
  if (age == null) return true
  return age > QUOTE_FRESHNESS_SLA_MS
}

/** True when any usable quote is sync-tagged and past the SLA. */
export function hasStaleSyncedQuotes(
  quotes: Iterable<MarketQuote>,
  nowMs = Date.now(),
): boolean {
  for (const q of quotes) {
    if (!(q.last > 0)) continue
    if (!isSyncedRemoteQuote(q)) continue
    if (isPastQuoteFreshnessSla(q, nowMs)) return true
  }
  return false
}

export function formatSlaAge(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}
