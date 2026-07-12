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
