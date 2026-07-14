/** Net worth history helpers + chart ranges + intraday snapshots. */

import { calcBreakdown } from './calc'
import type { HistoryPoint, PortfolioData } from './types'

/** Legacy period union — kept for callers during migration. */
export type HistoryPeriod = '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL'

/** Canonical chart timescale control. */
export type ChartRange = '1D' | '1W' | '1M' | '12M' | 'YTD' | '5Y' | 'ALL'

export const CHART_RANGES: ChartRange[] = ['1D', '1W', '1M', '12M', 'YTD', '5Y', 'ALL']

/** Retain ~5.5 years of points (daily + intraday). */
export const HISTORY_RETENTION = 2500

/** Min gap between intraday points (ms). */
export const INTRADAY_GAP_MS = 15 * 60_000

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function normalizeHistoryDate(date?: string | null): string {
  if (date == null || typeof date !== 'string') return ''
  return date.slice(0, 10)
}

function sortKey(h: HistoryPoint): string {
  return h.at ?? `${h.date}T23:59:59.000Z`
}

function buildRow(
  data: PortfolioData,
  source: HistoryPoint['source'],
  at?: string,
  notes?: string,
): HistoryPoint {
  const b = calcBreakdown(data)
  const when = at ?? new Date().toISOString()
  return {
    date: when.slice(0, 10),
    at: when,
    netWorth: b.netWorth,
    assets: b.assets,
    crypto: b.crypto.value,
    equity: b.equity.value,
    liabilities: b.liabilities,
    source,
    notes: notes?.trim() || undefined,
  }
}

/**
 * Upsert a snapshot. For the same calendar day:
 * - If last point is within INTRADAY_GAP_MS, update it in place.
 * - Otherwise append a new intraday point (enables meaningful 1D charts).
 * End-of-day style callers without forceIntraday still collapse when values unchanged.
 */
export function upsertDailySnapshot(
  data: PortfolioData,
  source: HistoryPoint['source'] = 'auto',
  opts?: { forceIntraday?: boolean },
): PortfolioData {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const row = buildRow(data, source, now)
  const hist = [...data.history]
    .map((h) => ({ ...h, date: normalizeHistoryDate(h.date) }))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  const todayIdxs = hist
    .map((h, i) => (h.date === today ? i : -1))
    .filter((i) => i >= 0)

  if (todayIdxs.length === 0) {
    hist.push(row)
    return { ...data, history: hist.slice(-HISTORY_RETENTION) }
  }

  const lastIdx = todayIdxs[todayIdxs.length - 1]
  const last = hist[lastIdx]
  const lastAt = last.at ?? `${last.date}T00:00:00.000Z`
  const gap = new Date(now).getTime() - new Date(lastAt).getTime()

  const sameValues =
    last.netWorth === row.netWorth &&
    last.crypto === row.crypto &&
    last.equity === row.equity &&
    last.liabilities === row.liabilities

  if (gap < INTRADAY_GAP_MS || (sameValues && !opts?.forceIntraday)) {
    hist[lastIdx] = { ...last, ...row, notes: last.notes ?? row.notes }
  } else {
    hist.push(row)
  }
  return { ...data, history: hist.slice(-HISTORY_RETENTION) }
}

export function appendManualSnapshot(data: PortfolioData, notes?: string): PortfolioData {
  const next = upsertDailySnapshot(data, 'manual', { forceIntraday: true })
  if (!notes?.trim()) return next
  const hist = [...next.history]
  const last = hist[hist.length - 1]
  if (last) hist[hist.length - 1] = { ...last, notes: notes.trim() }
  return { ...next, history: hist }
}

/** Lower-bound ISO date for a range, or null for ALL. */
export function rangeStartKey(range: ChartRange, now = new Date()): string | null {
  if (range === 'ALL') return null
  const start = new Date(now)
  if (range === '1D') start.setDate(now.getDate() - 1)
  else if (range === '1W') start.setDate(now.getDate() - 7)
  else if (range === '1M') start.setMonth(now.getMonth() - 1)
  else if (range === '12M') start.setFullYear(now.getFullYear() - 1)
  else if (range === 'YTD') {
    start.setMonth(0, 1)
    start.setHours(0, 0, 0, 0)
  } else if (range === '5Y') start.setFullYear(now.getFullYear() - 5)
  return start.toISOString().slice(0, 10)
}

export function filterByRange<T extends { date: string; at?: string }>(
  points: T[],
  range: ChartRange,
  now = new Date(),
): T[] {
  const sorted = [...points]
    .map((p) => ({ ...p, date: normalizeHistoryDate(p.date) }))
    .filter((p) => Boolean(p.date))
    .sort((a, b) => {
      const ka = a.at ?? `${a.date}T23:59:59.000Z`
      const kb = b.at ?? `${b.date}T23:59:59.000Z`
      return ka.localeCompare(kb)
    })
  const startKey = rangeStartKey(range, now)
  if (!startKey) return sorted
  if (range === '1D') {
    const startIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    return sorted.filter((p) => (p.at ?? `${p.date}T23:59:59.000Z`) >= startIso)
  }
  return sorted.filter((p) => p.date >= startKey)
}

export function rangeChange(
  points: HistoryPoint[],
  range: ChartRange,
  pick: (p: HistoryPoint) => number = (p) => p.netWorth,
): { change: number; pct: number } | null {
  const filtered = filterByRange(points, range)
  if (filtered.length < 2) return null
  const first = pick(filtered[0])
  const last = pick(filtered[filtered.length - 1])
  return {
    change: last - first,
    pct: first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0,
  }
}

function legacyToRange(period: HistoryPeriod): ChartRange {
  if (period === '3M') return '1M'
  if (period === '1Y') return '12M'
  return period
}

/** @deprecated Prefer filterByRange + ChartRange. */
export function filterHistory(history: HistoryPoint[], period: HistoryPeriod): HistoryPoint[] {
  return filterByRange(history, legacyToRange(period))
}

/** @deprecated Prefer rangeChange + ChartRange. */
export function periodChange(
  history: HistoryPoint[],
  period: HistoryPeriod,
): { change: number; pct: number } | null {
  return rangeChange(history, legacyToRange(period))
}

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

/** Parse YYYY-MM-DD (or ISO datetime) as local calendar date. */
function chartDayParts(isoDate: string): { day: number; month: number; year: number } | null {
  const dayStr = isoDate.slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayStr)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

/** e.g. 12 Jul */
export function formatChartDayMonth(isoDate: string): string {
  const p = chartDayParts(isoDate)
  if (!p) return isoDate.slice(0, 10)
  return `${String(p.day).padStart(2, '0')} ${MONTHS_SHORT[p.month - 1]}`
}

/** e.g. Jul 26 */
export function formatChartMonthYear(isoDate: string): string {
  const p = chartDayParts(isoDate)
  if (!p) return isoDate.slice(0, 7)
  return `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(2)}`
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / 86_400_000)
}

/**
 * Axis tick labels by range:
 * - 1D / 1W / 1M → DD MMM (1D with time → DD MMM HH:MM)
 * - 12M / 5Y / ALL → MMM YY
 * - YTD → DD MMM early in the year, MMM YY once past ~day 100
 */
export function formatChartTick(
  isoDate: string,
  range: ChartRange,
  at?: string,
  now = new Date(),
): string {
  if (range === '1D') {
    const base = formatChartDayMonth(isoDate)
    if (at && at.length >= 16) {
      const hm = at.slice(11, 16)
      if (/^\d{2}:\d{2}$/.test(hm)) return `${base} ${hm}`
    }
    return base
  }
  if (range === '1W' || range === '1M') return formatChartDayMonth(isoDate)
  if (range === 'YTD') {
    return dayOfYear(now) <= 100
      ? formatChartDayMonth(isoDate)
      : formatChartMonthYear(isoDate)
  }
  // 12M, 5Y, ALL
  return formatChartMonthYear(isoDate)
}

/** Tooltip header — always human-readable. */
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
