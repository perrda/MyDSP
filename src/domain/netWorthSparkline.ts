/** Today Assets trend series — 24H / 7D / 30D / 6M / YTD / 12M / 5Y / ALL. */

import type { HistoryPoint } from './types'

export type NwSparkWindow = '24H' | '7D' | '30D' | '6M' | 'YTD' | '12M' | '5Y' | 'ALL'

export const NW_SPARK_WINDOWS: readonly NwSparkWindow[] = [
  '24H',
  '7D',
  '30D',
  '6M',
  'YTD',
  '12M',
  '5Y',
  'ALL',
]

export type NwTrendPoint = {
  value: number
  label: string
  key: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function sortKey(h: HistoryPoint): string {
  return h.at ?? `${h.date}T23:59:59.000Z`
}

function finiteNw(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function pushFilled(
  out: NwTrendPoint[],
  last: { current: number | null },
  value: number | undefined,
  label: string,
  key: string,
): void {
  if (value != null && finiteNw(value)) {
    last.current = value
    out.push({ value, label, key })
  } else if (last.current != null) {
    out.push({ value: last.current, label, key })
  }
}

function historyInRange(history: HistoryPoint[] | undefined, startMs: number, endMs: number): HistoryPoint[] {
  return [...(history ?? [])]
    .filter((h) => finiteNw(h.netWorth))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .filter((h) => {
      const ms = new Date(sortKey(h)).getTime()
      return Number.isFinite(ms) && ms >= startMs && ms <= endMs
    })
}

function lastInHour(points: HistoryPoint[], hourStart: Date): number | undefined {
  const start = hourStart.getTime()
  const end = start + 60 * 60 * 1000
  let last: number | undefined
  for (const h of points) {
    const ms = new Date(sortKey(h)).getTime()
    if (ms >= start && ms < end) last = h.netWorth
  }
  return last
}

function lastOnDay(byDay: Map<string, number>, key: string): number | undefined {
  return byDay.get(key)
}

function lastInMonth(points: HistoryPoint[], year: number, monthIndex: number): number | undefined {
  const prefix = `${year}-${pad2(monthIndex + 1)}`
  let last: number | undefined
  for (const h of points) {
    if ((h.date ?? '').slice(0, 7) === prefix) last = h.netWorth
  }
  return last
}

function lastInYear(points: HistoryPoint[], year: number): number | undefined {
  const prefix = String(year)
  let last: number | undefined
  for (const h of points) {
    if ((h.date ?? '').slice(0, 4) === prefix) last = h.netWorth
  }
  return last
}

function dailyMap(history: HistoryPoint[] | undefined): Map<string, number> {
  const byDay = new Map<string, number>()
  const sorted = [...(history ?? [])]
    .filter((h) => finiteNw(h.netWorth) && (h.date ?? '').length >= 10)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  for (const h of sorted) {
    byDay.set(h.date.slice(0, 10), h.netWorth)
  }
  return byDay
}

/** Daily NW values for the last `days` calendar days (forward-filled). */
export function netWorthSparkSeries(
  history: HistoryPoint[] | undefined,
  currentNw: number,
  days: 7 | 30,
  now = new Date(),
): number[] {
  return netWorthTrendSeries(history, currentNw, days === 7 ? '7D' : '30D', now).map((p) => p.value)
}

function dailySeries(
  history: HistoryPoint[] | undefined,
  currentNw: number,
  start: Date,
  days: number,
  labelFor: (d: Date) => string,
): NwTrendPoint[] {
  const last = { current: null as number | null }
  const out: NwTrendPoint[] = []
  const today = ymdLocal(new Date(start.getFullYear(), start.getMonth(), start.getDate() + (days - 1)))
  const byDay = dailyMap(history)
  byDay.set(today, currentNw)
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = ymdLocal(d)
    pushFilled(out, last, lastOnDay(byDay, key), labelFor(d), key)
  }
  return out
}

function monthlySeries(
  allPoints: HistoryPoint[],
  currentNw: number,
  start: Date,
  count: number,
): NwTrendPoint[] {
  const last = { current: null as number | null }
  const out: NwTrendPoint[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
    const isLast = i === count - 1
    pushFilled(
      out,
      last,
      isLast ? currentNw : lastInMonth(allPoints, d.getFullYear(), d.getMonth()),
      MONTHS_SHORT[d.getMonth()]!,
      key,
    )
  }
  return out
}

/**
 * Labeled Assets trend for Today.
 * 24H → last 24 clock hours as 01…23, 00
 * 7D → last 7 weekdays (Mon…Sun)
 * 30D → last 30 days as DD/MM
 * 6M → last 6 months as MMM
 * YTD → Jan…current month as MMM (January uses DD/MM days)
 * 12M → last 12 months as MMM
 * 5Y / ALL → annual calendar years
 */
export function netWorthTrendSeries(
  history: HistoryPoint[] | undefined,
  currentNw: number,
  window: NwSparkWindow,
  now = new Date(),
): NwTrendPoint[] {
  const last = { current: null as number | null }
  let out: NwTrendPoint[] = []

  if (window === '24H') {
    const end = new Date(now)
    end.setMinutes(0, 0, 0)
    const start = new Date(end)
    start.setHours(start.getHours() - 23)
    const points = historyInRange(history, start.getTime() - 60 * 60 * 1000, now.getTime() + 1)
    for (let i = 0; i < 24; i++) {
      const hour = new Date(start)
      hour.setHours(start.getHours() + i)
      const label = pad2(hour.getHours())
      const key = `${ymdLocal(hour)}T${label}`
      const isLast = i === 23
      pushFilled(out, last, isLast ? currentNw : lastInHour(points, hour), label, key)
    }
    return out.length >= 2 ? out : []
  }

  if (window === '7D' || window === '30D') {
    const days = window === '7D' ? 7 : 30
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
    out = dailySeries(history, currentNw, start, days, (d) =>
      window === '7D' ? WEEKDAYS[d.getDay()]! : `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
    )
    return out.length >= 2 ? out : []
  }

  const allPoints = [...(history ?? [])]
    .filter((h) => finiteNw(h.netWorth))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  if (window === 'YTD' && now.getMonth() === 0) {
    const start = new Date(now.getFullYear(), 0, 1)
    out = dailySeries(
      history,
      currentNw,
      start,
      now.getDate(),
      (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
    )
    if (out.length === 1) {
      const only = out[0]!
      out = [{ ...only, key: `${only.key}-pre` }, only]
    }
    return out.length >= 2 ? out : []
  }

  if (window === '6M' || window === 'YTD' || window === '12M') {
    const count = window === '6M' ? 6 : window === '12M' ? 12 : now.getMonth() + 1
    const start =
      window === 'YTD'
        ? new Date(now.getFullYear(), 0, 1)
        : new Date(now.getFullYear(), now.getMonth() - (count - 1), 1)
    out = monthlySeries(allPoints, currentNw, start, count)
    return out.length >= 2 ? out : []
  }

  const thisYear = now.getFullYear()
  let firstYear = thisYear
  if (window === '5Y') {
    firstYear = thisYear - 4
  } else {
    const oldest = allPoints[0]?.date?.slice(0, 4)
    const parsed = oldest ? Number(oldest) : thisYear
    firstYear = Number.isFinite(parsed) ? Math.min(parsed, thisYear) : thisYear
    if (firstYear === thisYear && allPoints.length > 0) firstYear = thisYear - 1
  }

  for (let year = firstYear; year <= thisYear; year++) {
    const isLast = year === thisYear
    pushFilled(out, last, isLast ? currentNw : lastInYear(allPoints, year), String(year), String(year))
  }
  if (out.length === 1) {
    const only = out[0]!
    out = [{ ...only, key: `${only.key}-pre` }, only]
  }
  return out.length >= 2 ? out : []
}
