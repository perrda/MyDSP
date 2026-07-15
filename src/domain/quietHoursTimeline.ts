/** Helpers for quiet-hours preview (24h timeline). */

/** Minutes since local midnight from "HH:MM". */
export function timeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return 0
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = Math.min(59, Math.max(0, Number(m[2])))
  return h * 60 + min
}

export function nowMinutes(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}

export type QuietSegment = { startPct: number; endPct: number }

/**
 * Quiet window as one or two segments on a 0–100% day bar.
 * Overnight ranges (start > end) wrap midnight.
 */
export function quietSegments(start: string, end: string): QuietSegment[] {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  const day = 24 * 60
  if (s === e) return []
  if (s < e) {
    return [{ startPct: (s / day) * 100, endPct: (e / day) * 100 }]
  }
  return [
    { startPct: (s / day) * 100, endPct: 100 },
    { startPct: 0, endPct: (e / day) * 100 },
  ]
}

export function nowPct(now = new Date()): number {
  return (nowMinutes(now) / (24 * 60)) * 100
}

export function isInQuietWindow(start: string, end: string, now = new Date()): boolean {
  const current = nowMinutes(now)
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  if (s === e) return false
  if (s > e) return current >= s || current <= e
  return current >= s && current <= e
}
