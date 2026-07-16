/** Cross-device Markets quote cache — packed into fullArchive alongside the watchlist. */

import type { MarketQuote } from './markets'
import { mergeMarketQuotes, quotesMapToRecord, quotesRecordToMap } from './marketQuotesCache'

/** Tag a quote as arriving from another device (encrypted sync / backup). */
export function tagQuoteFromSync(q: MarketQuote): MarketQuote {
  const src = (q.source || 'remote').trim()
  if (src.startsWith('sync:')) return q
  return { ...q, source: `sync:${src}` }
}

export function isSyncedRemoteQuote(q: MarketQuote | undefined): boolean {
  if (!q) return false
  return (q.source || '').toLowerCase().startsWith('sync:')
}

/**
 * Prefer the newer print by `updatedAt` when both sides have a usable last.
 * Remote-winning quotes are tagged `sync:` so UI can show “From other device”.
 */
export function mergeQuotesForSync(
  local: Map<string, MarketQuote>,
  remote: Map<string, MarketQuote>,
): Map<string, MarketQuote> {
  const taggedRemote = new Map<string, MarketQuote>()
  for (const [id, q] of remote) {
    taggedRemote.set(id, tagQuoteFromSync(q))
  }

  const out = new Map<string, MarketQuote>()
  const ids = new Set([...local.keys(), ...taggedRemote.keys()])
  for (const id of ids) {
    const lq = local.get(id)
    const rq = taggedRemote.get(id)
    if (lq && lq.last > 0 && rq && rq.last > 0) {
      const lt = Date.parse(lq.updatedAt) || 0
      const rt = Date.parse(rq.updatedAt) || 0
      out.set(id, rt >= lt ? rq : lq)
      continue
    }
    if (rq && rq.last > 0) {
      out.set(id, rq)
      continue
    }
    if (lq && lq.last > 0) {
      out.set(id, lq)
      continue
    }
    if (rq) out.set(id, rq)
    else if (lq) out.set(id, lq)
  }

  // Preserve sparklines/% when the winner is thin (same rules as live merge)
  return mergeMarketQuotes(local, out)
}

export function exportMarketQuotesForBackup(
  map: Map<string, MarketQuote>,
): Record<string, MarketQuote> {
  return quotesMapToRecord(map)
}

export function parseMarketQuotesBackup(raw: unknown): Map<string, MarketQuote> {
  return quotesRecordToMap(raw)
}
