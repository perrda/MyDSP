/**
 * Canonical chart axis rules for MyDSP — use across every money/time series chart
 * (web · tablet · phone, portrait · landscape).
 *
 * X-axis interval by ChartRange:
 *   1D  → hourly
 *   1W  → daily
 *   1M  → weekly
 *   12M → monthly
 *   YTD → daily/weekly early year, else monthly (by span)
 *   5Y  → yearly
 *   ALL → pick from span (hourly → daily → weekly → monthly → yearly)
 *
 * Y-axis: compact, currency-aware ticks via formatChartYTick (GBP/USD/THB/BTC).
 *
 * Never use the formatted label as the category dataKey — duplicate month labels
 * (e.g. every July day → "Jul 26") collapse into identical X ticks.
 */

import type { ChartRange } from './history'
import { formatGBP, getDisplayCurrency } from '../utils/format'

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export type ChartAxisPoint = { date: string; at?: string }

export type ChartXInterval = 'hour' | 'day' | 'week' | 'month' | 'year'

function chartDayParts(isoDate: string): { day: number; month: number; year: number } | null {
  const dayStr = isoDate.slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayStr)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

function pointMs(p: ChartAxisPoint): number {
  const iso = p.at && p.at.length >= 16 ? p.at : `${p.date.slice(0, 10)}T12:00:00.000Z`
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

function spanDays(points: ChartAxisPoint[]): number {
  if (points.length < 2) return 0
  const a = pointMs(points[0]!)
  const b = pointMs(points[points.length - 1]!)
  return Math.max(0, (b - a) / 86_400_000)
}

/** Choose X tick interval from range + actual data span (ALL / YTD adapt). */
export function chartXIntervalFor(
  range: ChartRange,
  points: ChartAxisPoint[],
  now = new Date(),
): ChartXInterval {
  const days = spanDays(points)
  if (range === '1D') return 'hour'
  if (range === '1W') return 'day'
  if (range === '1M') return 'week'
  if (range === '12M') return 'month'
  if (range === '5Y') return 'year'
  if (range === 'YTD') {
    const doy =
      Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
      ) || days
    if (doy <= 21 || days <= 21) return 'day'
    if (doy <= 90 || days <= 90) return 'week'
    return 'month'
  }
  // ALL — adapt to history length
  if (days <= 1.5) return 'hour'
  if (days <= 14) return 'day'
  if (days <= 90) return 'week'
  if (days <= 800) return 'month'
  return 'year'
}

function bucketKey(p: ChartAxisPoint, interval: ChartXInterval): string {
  const ms = pointMs(p)
  const d = new Date(ms)
  if (interval === 'hour') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`
  }
  const day = p.date.slice(0, 10)
  const parts = chartDayParts(day)
  if (!parts) return day
  if (interval === 'day') return day
  if (interval === 'week') {
    // ISO-ish week start (Mon) in UTC from point date
    const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
    const dow = (dt.getUTCDay() + 6) % 7 // Mon=0
    dt.setUTCDate(dt.getUTCDate() - dow)
    return dt.toISOString().slice(0, 10)
  }
  if (interval === 'month') {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}`
  }
  return String(parts.year)
}

/** Format a single X tick for the chosen interval. */
export function formatChartXTick(
  isoDate: string,
  interval: ChartXInterval,
  at?: string,
): string {
  if (interval === 'hour') {
    const src = at && at.length >= 16 ? at : isoDate
    const hm = src.includes('T') ? src.slice(11, 16) : ''
    if (/^\d{2}:\d{2}$/.test(hm)) {
      // Prefer H:MM without leading zero noise on the hour when possible
      const h = Number(hm.slice(0, 2))
      const m = hm.slice(3, 5)
      return `${h}:${m}`
    }
    const p = chartDayParts(isoDate)
    if (p) return `${String(p.day).padStart(2, '0')} ${MONTHS_SHORT[p.month - 1]}`
    return isoDate.slice(0, 10)
  }
  const p = chartDayParts(isoDate)
  if (!p) return isoDate.slice(0, 10)
  if (interval === 'day') {
    return `${String(p.day).padStart(2, '0')} ${MONTHS_SHORT[p.month - 1]}`
  }
  if (interval === 'week') {
    return `${String(p.day).padStart(2, '0')} ${MONTHS_SHORT[p.month - 1]}`
  }
  if (interval === 'month') {
    return `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(2)}`
  }
  return String(p.year)
}

/**
 * Build chart rows with unique `xKey` (for Recharts category axis) and a display `tick`.
 * Also returns the list of `xKey`s that should be drawn as axis ticks (one per interval bucket).
 */
export function buildChartAxisRows<T extends ChartAxisPoint>(
  points: T[],
  range: ChartRange,
  now = new Date(),
): {
  rows: Array<T & { xKey: string; tick: string }>
  tickKeys: string[]
  interval: ChartXInterval
} {
  const interval = chartXIntervalFor(range, points, now)
  const rows = points.map((p, i) => {
    const day = p.date.slice(0, 10)
    const xKey = p.at && p.at.length >= 16 ? p.at : `${day}#${i}`
    return {
      ...p,
      xKey,
      tick: formatChartXTick(day, interval, p.at),
    }
  })

  // First point per bucket → axis tick (preserve start/end)
  const seen = new Set<string>()
  const tickKeys: string[] = []
  for (const row of rows) {
    const b = bucketKey(row, interval)
    if (seen.has(b)) continue
    seen.add(b)
    tickKeys.push(row.xKey)
  }
  if (rows.length > 0) {
    const last = rows[rows.length - 1]!.xKey
    if (!tickKeys.includes(last)) tickKeys.push(last)
  }

  // Cap density for narrow screens (~6–8 labels)
  const maxTicks = 8
  if (tickKeys.length > maxTicks) {
    const out: string[] = [tickKeys[0]!]
    const step = (tickKeys.length - 1) / (maxTicks - 1)
    for (let i = 1; i < maxTicks - 1; i++) {
      out.push(tickKeys[Math.round(i * step)]!)
    }
    out.push(tickKeys[tickKeys.length - 1]!)
    return { rows, tickKeys: [...new Set(out)], interval }
  }

  return { rows, tickKeys, interval }
}

/**
 * Range-aware X label (legacy API used by older call sites).
 * Prefer buildChartAxisRows for new charts.
 */
export function formatChartTick(
  isoDate: string,
  range: ChartRange,
  at?: string,
  now = new Date(),
): string {
  const interval = chartXIntervalFor(range, [{ date: isoDate, at }], now)
  // For single-point legacy calls, infer interval from range only (ignore 0-span ALL→hour).
  let forced: ChartXInterval = interval
  if (range === '1D') forced = 'hour'
  else if (range === '1W') forced = 'day'
  else if (range === '1M') forced = 'week'
  else if (range === '12M') forced = 'month'
  else if (range === '5Y') forced = 'year'
  else if (range === 'YTD') {
    const doy = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
    )
    forced = doy <= 21 ? 'day' : doy <= 90 ? 'week' : 'month'
  } else if (range === 'ALL') {
    forced = 'month'
  }
  return formatChartXTick(isoDate, forced, at)
}

export function formatChartDayMonth(isoDate: string): string {
  const p = chartDayParts(isoDate)
  if (!p) return isoDate.slice(0, 10)
  return `${String(p.day).padStart(2, '0')} ${MONTHS_SHORT[p.month - 1]}`
}

export function formatChartMonthYear(isoDate: string): string {
  const p = chartDayParts(isoDate)
  if (!p) return isoDate.slice(0, 7)
  return `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(2)}`
}

export function formatChartTooltipLabel(isoOrAt: string): string {
  if (!isoOrAt) return ''
  if (isoOrAt.length >= 16 && isoOrAt.includes('T')) {
    const base = formatChartDayMonth(isoOrAt)
    const hm = isoOrAt.slice(11, 16)
    return /^\d{2}:\d{2}$/.test(hm) ? `${base} ${hm}` : base
  }
  const p = chartDayParts(isoOrAt)
  if (!p) return isoOrAt
  return `${formatChartDayMonth(isoOrAt)} ${p.year}`
}

/**
 * Compact Y-axis money tick in the active display currency.
 * GBP/USD → £12k / USD 12k; THB → compact millions; BTC → ₿ decimals.
 */
export function formatChartYTick(gbpAmount: number): string {
  const currency = (getDisplayCurrency() ?? 'GBP').toUpperCase()
  if (currency === 'BTC') {
    return formatGBP(gbpAmount, { compact: true })
  }
  // High-denomination / large magnitudes: compact notation keeps labels readable on phone
  return formatGBP(gbpAmount, { compact: true })
}

/** Percentage Y ticks (0–100 or signed). */
export function formatChartPctTick(v: number, digits = 0): string {
  return `${v.toFixed(digits)}%`
}

/** Windows that can label an unlabeled close series (Markets / Today-style). */
export type SeriesAxisWindow =
  | '24H'
  | '7D'
  | '1W'
  | '30D'
  | '1M'
  | '12M'
  | '5Y'
  | 'YTD'
  | 'ALL'

export type LabeledSeriesPoint = {
  value: number
  label: string
  key: string
}

export type ChartQuoteKind = 'crypto' | 'equity' | 'commodity' | 'fx' | 'cross' | 'index'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function interpolateDate(start: Date, end: Date, t: number): Date {
  const a = start.getTime()
  const b = end.getTime()
  return new Date(a + (b - a) * t)
}

/**
 * X labels for a bare number[] series.
 * 24H → 01…23, 00 · 7D/1W → weekdays · 30D/1M → DD/MM · 12M/YTD → MMM · 5Y/ALL → years
 */
export function labeledSeriesFromValues(
  values: number[],
  window: SeriesAxisWindow,
  now = new Date(),
): LabeledSeriesPoint[] {
  const clean = values.filter((n) => typeof n === 'number' && Number.isFinite(n))
  const n = clean.length
  if (n === 0) return []

  return clean.map((value, i) => {
    const t = n === 1 ? 1 : i / (n - 1)
    const { label, key } = labelAtFraction(window, t, now)
    return { value, label, key: `${key}#${i}` }
  })
}

function labelAtFraction(
  window: SeriesAxisWindow,
  t: number,
  now: Date,
): { label: string; key: string } {
  if (window === '24H') {
    const end = new Date(now)
    end.setMinutes(0, 0, 0)
    const start = new Date(end)
    start.setHours(start.getHours() - 23)
    const d = interpolateDate(start, end, t)
    const label = pad2(d.getHours())
    return { label, key: `${ymdLocal(d)}T${label}` }
  }

  if (window === '7D' || window === '1W') {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    const d = interpolateDate(start, end, t)
    return { label: WEEKDAY_SHORT[d.getDay()]!, key: ymdLocal(d) }
  }

  if (window === '30D' || window === '1M') {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = new Date(end)
    start.setDate(start.getDate() - 29)
    const d = interpolateDate(start, end, t)
    return { label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`, key: ymdLocal(d) }
  }

  if (window === '12M') {
    const end = new Date(now.getFullYear(), now.getMonth(), 1)
    const start = new Date(end.getFullYear(), end.getMonth() - 11, 1)
    const months = Math.round(11 * t)
    const d = new Date(start.getFullYear(), start.getMonth() + months, 1)
    return { label: MONTHS_SHORT[d.getMonth()]!, key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` }
  }

  if (window === 'YTD') {
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const d = interpolateDate(start, end.getTime() >= start.getTime() ? end : start, t)
    const days = Math.max(0, (end.getTime() - start.getTime()) / 86_400_000)
    if (days <= 90) {
      return { label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`, key: ymdLocal(d) }
    }
    return { label: MONTHS_SHORT[d.getMonth()]!, key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` }
  }

  const thisYear = now.getFullYear()
  const span = window === '5Y' ? 4 : 9
  const firstYear = thisYear - span
  const year = Math.round(firstYear + t * span)
  return { label: String(year), key: String(year) }
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/**
 * Y tick for Markets quotes: GBP-stored kinds follow display CCY;
 * index / FX / cross stay in native units (not converted as money).
 */
export function formatChartQuoteYTick(value: number, kind: ChartQuoteKind): string {
  if (kind === 'crypto' || kind === 'equity' || kind === 'commodity') {
    return formatChartYTick(value)
  }
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 10_000) {
    return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  }
  if (abs >= 100) {
    return value.toLocaleString('en-GB', { maximumFractionDigits: 0 })
  }
  return value.toLocaleString('en-GB', {
    maximumFractionDigits: abs >= 1 ? 2 : 4,
  })
}
