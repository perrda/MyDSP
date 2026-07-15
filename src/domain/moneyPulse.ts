/** Today “money pulse”: net-worth change vs yesterday (from history). */

import type { HistoryPoint } from './types'

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function yesterdayKey(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  return ymdLocal(d)
}

export function todayKeyLocal(now = new Date()): string {
  return ymdLocal(now)
}

function sortKey(h: HistoryPoint): string {
  return h.at ?? `${h.date}T23:59:59.000Z`
}

/**
 * Baseline NW for the pulse: prefer last snapshot on yesterday’s calendar day;
 * else most recent point strictly before today. Null when no history.
 */
export function findBaselineNetWorth(
  history: HistoryPoint[],
  now = new Date(),
): { netWorth: number; date: string } | null {
  const today = todayKeyLocal(now)
  const yesterday = yesterdayKey(now)
  const prior = [...(history ?? [])]
    .filter((h) => h.date && h.date < today && Number.isFinite(h.netWorth))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  if (prior.length === 0) return null
  const yHits = prior.filter((h) => h.date === yesterday)
  const hit = yHits.length > 0 ? yHits[yHits.length - 1] : prior[prior.length - 1]
  return { netWorth: hit.netWorth, date: hit.date }
}

export function moneyPulseDelta(
  history: HistoryPoint[],
  currentNw: number,
  now = new Date(),
): { delta: number; baselineDate: string } | null {
  const base = findBaselineNetWorth(history, now)
  if (!base) return null
  return { delta: currentNw - base.netWorth, baselineDate: base.date }
}

/** One-line label; returns null when no baseline. */
export function formatMoneyPulseLine(
  delta: number | null | undefined,
  formatMoney: (n: number, opts?: { signed?: boolean }) => string,
): string | null {
  if (delta == null || !Number.isFinite(delta)) return null
  if (Math.abs(delta) < 0.005) return 'NW unchanged since yesterday'
  return `NW ${formatMoney(delta, { signed: true })} since yesterday`
}
