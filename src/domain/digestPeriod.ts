/** Digest period windows — Daily is rolling 24h; others are calendar-length lookbacks. */

import type { HistoryPoint } from './types'
import { isBudgetSpend } from './budgetChart'

export const DIGEST_PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'annual'] as const
export type DigestPeriod = (typeof DIGEST_PERIODS)[number]
export type DigestPdfOrientation = 'landscape' | 'portrait'

export const BTC_ORANGE = '#F7931A'
export const DIGEST_NEGATIVE = '#ef4444'
export const DIGEST_SLICE_EQUITY = '#F7931A'
export const DIGEST_SLICE_CRYPTO = '#86efac'

export type DigestHistoryPoint = Pick<HistoryPoint, 'date' | 'netWorth'> & {
  at?: string
}

export type DigestSpendEntry = {
  date?: string
  amount: number
  category?: string
}

export function isDigestPeriod(value: unknown): value is DigestPeriod {
  return typeof value === 'string' && (DIGEST_PERIODS as readonly string[]).includes(value)
}

export function digestPeriodLabel(period: DigestPeriod): string {
  return {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    annual: 'Annual',
  }[period]
}

/** Short Δ chip label — never leave “Week Δ” on a non-weekly period. */
export function digestDeltaLabel(period: DigestPeriod): string {
  return {
    daily: '24h Δ',
    weekly: 'Week Δ',
    monthly: 'Month Δ',
    quarterly: 'Quarter Δ',
    annual: 'Year Δ',
  }[period]
}

export function digestChangeLabel(period: DigestPeriod): string {
  return {
    daily: '24h change',
    weekly: 'Week change',
    monthly: 'Month change',
    quarterly: 'Quarter change',
    annual: 'Year change',
  }[period]
}

export function digestTitle(period: DigestPeriod): string {
  return `MyDSP ${digestPeriodLabel(period).toLowerCase()} digest`
}

export function digestLookbackDays(period: Exclude<DigestPeriod, 'daily'>): number {
  return { weekly: 7, monthly: 30, quarterly: 90, annual: 365 }[period]
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addLocalDays(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
}

/** Timestamp for a history row. Missing `at` uses local end of `date` — never invent a NW. */
export function digestPointMs(point: DigestHistoryPoint): number | null {
  if (point.at) {
    const t = Date.parse(point.at)
    if (Number.isFinite(t)) return t
  }
  const key = (point.date ?? '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return new Date(y, mo - 1, d, 23, 59, 59, 0).getTime()
}

export function digestCutoffMs(period: DigestPeriod, now = new Date()): number {
  if (period === 'daily') return now.getTime() - 24 * 60 * 60 * 1000
  return addLocalDays(now, -digestLookbackDays(period)).getTime()
}

export function digestCutoffDateKey(period: Exclude<DigestPeriod, 'daily'>, now = new Date()): string {
  return ymdLocal(addLocalDays(now, -digestLookbackDays(period)))
}

/**
 * Latest priced point at or before the window start.
 * Daily uses rolling 24h timestamps. Missing baseline → null (honest em dash).
 */
export function periodDeltaFromHistory(
  history: DigestHistoryPoint[] | undefined,
  currentNetWorth: number,
  period: DigestPeriod,
  now = new Date(),
): number | null {
  if (!Number.isFinite(currentNetWorth)) return null
  const rows = (history ?? []).filter((h) => Number.isFinite(h.netWorth))
  if (!rows.length) return null

  if (period === 'daily') {
    const cutoff = digestCutoffMs('daily', now)
    const prior = rows
      .map((h) => ({ t: digestPointMs(h), netWorth: h.netWorth }))
      .filter((h): h is { t: number; netWorth: number } => h.t != null && h.t <= cutoff)
      .sort((a, b) => a.t - b.t)
    const baseline = prior[prior.length - 1]
    if (!baseline) return null
    return currentNetWorth - baseline.netWorth
  }

  const cutoffKey = digestCutoffDateKey(period, now)
  const prior = [...rows]
    .filter((h) => (h.date ?? '').slice(0, 10) && h.date.slice(0, 10) <= cutoffKey)
    .sort((a, b) => {
      const da = (a.date ?? '').slice(0, 10)
      const db = (b.date ?? '').slice(0, 10)
      if (da !== db) return da.localeCompare(db)
      return (a.at ?? '').localeCompare(b.at ?? '')
    })
  const baseline = prior[prior.length - 1]
  if (!baseline) return null
  return currentNetWorth - baseline.netWorth
}

export type DigestSeriesPoint = { t: number; netWorth: number }

/**
 * Real history points inside the selected window, plus current NW.
 * Never forward-fills or invents 0. Empty when fewer than 2 priced points.
 */
export function digestNwSeries(
  history: DigestHistoryPoint[] | undefined,
  currentNetWorth: number,
  period: DigestPeriod,
  now = new Date(),
): DigestSeriesPoint[] {
  if (!Number.isFinite(currentNetWorth)) return []
  const cutoff = digestCutoffMs(period, now)
  const nowMs = now.getTime()
  const points = (history ?? [])
    .map((h) => ({ t: digestPointMs(h), netWorth: h.netWorth }))
    .filter(
      (h): h is DigestSeriesPoint =>
        h.t != null && Number.isFinite(h.netWorth) && h.t >= cutoff && h.t <= nowMs,
    )
    .sort((a, b) => a.t - b.t)

  const last = points[points.length - 1]
  if (!last || Math.abs(last.t - nowMs) > 60_000 || last.netWorth !== currentNetWorth) {
    points.push({ t: nowMs, netWorth: currentNetWorth })
  }
  return points.length >= 2 ? points : []
}

export function spendInDigestWindow(
  spending: DigestSpendEntry[] | undefined,
  period: DigestPeriod,
  now = new Date(),
): number | null {
  if (!spending?.length) return null
  const cutoffKey =
    period === 'daily'
      ? ymdLocal(new Date(digestCutoffMs('daily', now)))
      : digestCutoffDateKey(period, now)
  let sum = 0
  let any = false
  for (const row of spending) {
    if (!isBudgetSpend(row)) continue
    const key = (row.date ?? '').slice(0, 10)
    if (!key || key < cutoffKey) continue
    if (!Number.isFinite(row.amount)) continue
    sum += Math.abs(row.amount)
    any = true
  }
  return any ? sum : null
}

export function digestSpendLabel(period: DigestPeriod): string {
  return {
    daily: 'Spend (24h)',
    weekly: 'Spend (7d)',
    monthly: 'Spend (30d)',
    quarterly: 'Spend (90d)',
    annual: 'Spend (365d)',
  }[period]
}

/** Collapse duplicate mover lines (Top mover SI=F + Commodity mover SI=F). */
export function dedupeHighlightLines(lines: string[] | undefined): string[] {
  if (!lines?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const key = normalizeHighlightKey(line)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
  }
  return out
}

function normalizeHighlightKey(line: string): string {
  return line
    .toLowerCase()
    .replace(/^(top mover|commodity mover)\s+/i, '')
    .replace(/\s*\(commodity\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function digestFilenameStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function digestHtmlFilename(period: DigestPeriod, date = new Date()): string {
  return `mydsp-${period}-digest-${digestFilenameStamp(date)}.html`
}

export function digestPdfFilename(
  period: DigestPeriod,
  orientation: DigestPdfOrientation,
  date = new Date(),
): string {
  return `mydsp-${period}-digest-${orientation}-${digestFilenameStamp(date)}.pdf`
}

export type DigestSliceView = {
  name: string
  value: number
  color: string
  shareLabel: string
}

export type DigestPortfolioView = {
  name: string
  valueLabel: string
}

export type DigestViewModel = {
  period: DigestPeriod
  title: string
  generatedLabel: string
  windowCopy: string
  netWorthLabel: string
  deltaLabel: string
  deltaValue: string
  deltaTone: 'up' | 'down' | 'flat' | 'missing'
  assetsLabel: string
  liabilitiesLabel: string
  slices: DigestSliceView[]
  series: DigestSeriesPoint[]
  seriesEmpty: boolean
  highlights: string[]
  portfolios: DigestPortfolioView[]
  footer: string
}
