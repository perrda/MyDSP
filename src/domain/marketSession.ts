/** Rough timezone-aware session hours for equity / index Open·Closed chips. */

import type { MarketAssetKind } from './markets'

export type MarketSessionVenue = 'US' | 'UK'

export type MarketSessionStatus = {
  open: boolean
  label: 'Open' | 'Closed'
  venue: MarketSessionVenue
  /** Short hint e.g. "US RTH 09:30–16:00 ET" */
  hint: string
}

/** US cash equities / major US indices → America/New_York RTH 09:30–16:00. */
const US_RTH = { openMin: 9 * 60 + 30, closeMin: 16 * 60, tz: 'America/New_York' as const }
/** LSE / FTSE → Europe/London 08:00–16:30. */
const UK_RTH = { openMin: 8 * 60, closeMin: 16 * 60 + 30, tz: 'Europe/London' as const }

const UK_INDEX_SYMBOLS = new Set(['^FTSE', 'FTSE', 'UKX', '^UKX'])

function partsInTz(now: Date, timeZone: string): { weekday: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = fmt.formatToParts(now)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return { weekday, hour, minute }
}

function isWeekday(weekday: string): boolean {
  // en-GB short: Mon Tue Wed Thu Fri Sat Sun
  return weekday !== 'Sat' && weekday !== 'Sun'
}

function isOpenNow(now: Date, venue: MarketSessionVenue): boolean {
  const hours = venue === 'UK' ? UK_RTH : US_RTH
  const { weekday, hour, minute } = partsInTz(now, hours.tz)
  if (!isWeekday(weekday)) return false
  const mins = hour * 60 + minute
  return mins >= hours.openMin && mins < hours.closeMin
}

/** Infer US vs UK session from symbol (FTSE → UK; COMEX commodities → US; equities/indices default US). */
export function sessionVenueForSymbol(symbol: string, kind: MarketAssetKind): MarketSessionVenue | null {
  if (kind !== 'equity' && kind !== 'index' && kind !== 'commodity') return null
  const key = symbol.trim().toUpperCase()
  if (UK_INDEX_SYMBOLS.has(key) || key.includes('FTSE') || key.endsWith('.L')) return 'UK'
  return 'US'
}

export function marketSessionStatus(
  symbol: string,
  kind: MarketAssetKind,
  now: Date = new Date(),
): MarketSessionStatus | null {
  const venue = sessionVenueForSymbol(symbol, kind)
  if (!venue) return null
  const open = isOpenNow(now, venue)
  const { weekday } = partsInTz(now, venue === 'UK' ? UK_RTH.tz : US_RTH.tz)
  const weekend = !isWeekday(weekday)
  let hint =
    venue === 'UK' ? 'UK RTH 08:00–16:30 London' : 'US RTH 09:30–16:00 ET'
  if (kind === 'commodity') {
    hint = weekend
      ? 'COMEX weekend — futures closed; try spot aliases (XAUUSD=X) or last-good cache'
      : open
        ? 'COMEX RTH (approx. US cash hours) — futures live'
        : 'COMEX closed — spot fallback may still quote; otherwise last-good / Unavailable'
  }
  return {
    open,
    label: open ? 'Open' : 'Closed',
    venue,
    hint,
  }
}
