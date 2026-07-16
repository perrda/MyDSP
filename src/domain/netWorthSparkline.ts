/** Compact net-worth sparkline series from history (7d / 30d). */

import type { HistoryPoint } from './types'

export type NwSparkWindow = 7 | 30

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sortKey(h: HistoryPoint): string {
  return h.at ?? `${h.date}T23:59:59.000Z`
}

/**
 * Daily NW series for the last `days` calendar days (forward-filled).
 * Appends `currentNw` for today. Empty when fewer than 2 points.
 */
export function netWorthSparkSeries(
  history: HistoryPoint[] | undefined,
  currentNw: number,
  days: NwSparkWindow,
  now = new Date(),
): number[] {
  const today = ymdLocal(now)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
  const startKey = ymdLocal(start)

  const byDay = new Map<string, number>()
  const sorted = [...(history ?? [])]
    .filter((h) => {
      const d = (h.date ?? '').slice(0, 10)
      return d >= startKey && d <= today && Number.isFinite(h.netWorth)
    })
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  for (const h of sorted) {
    byDay.set(h.date.slice(0, 10), h.netWorth)
  }
  byDay.set(today, currentNw)

  const filled: number[] = []
  let last: number | null = null
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = ymdLocal(d)
    const v = byDay.get(key)
    if (v != null && Number.isFinite(v)) {
      last = v
      filled.push(v)
    } else if (last != null) {
      filled.push(last)
    }
  }
  return filled.length >= 2 ? filled : []
}
