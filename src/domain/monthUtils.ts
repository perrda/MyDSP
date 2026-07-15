/** Calendar month helpers (YYYY-MM). */

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1 + delta, 1)
  return monthKey(d)
}

export function parseMonthParam(raw: string | null | undefined, fallback = monthKey()): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw
  return fallback
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

/** Days to use when projecting spend for a YYYY-MM budget month. */
export function daysElapsedInMonth(ym: string, now = new Date()): number {
  const year = Number(ym.slice(0, 4))
  const month = Number(ym.slice(5, 7))
  if (!year || !month) return 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const currentYm = monthKey(now)
  if (ym < currentYm) return daysInMonth
  if (ym > currentYm) return 1
  return Math.max(1, Math.min(now.getDate(), daysInMonth))
}

export function daysInMonth(ym: string): number {
  const year = Number(ym.slice(0, 4))
  const month = Number(ym.slice(5, 7))
  if (!year || !month) return 30
  return new Date(year, month, 0).getDate()
}
