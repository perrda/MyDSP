/** Period digest — preview / share on mobile, HTML + designed A4 PDF. Nothing is emailed. */

import { formatGBP } from '../utils/format'
import { downloadPdf } from '../utils/exportFormats'
import { allocationDonutSvg, allocationSlices, formatAllocationShare, nwSparklineSvg } from './digestCharts'
import {
  type DigestHistoryPoint,
  type DigestPdfOrientation,
  type DigestPeriod,
  type DigestSpendEntry,
  type DigestViewModel,
  BTC_ORANGE,
  dedupeHighlightLines,
  digestCutoffMs,
  digestDeltaLabel,
  digestHtmlFilename,
  digestPeriodLabel,
  digestSpendLabel,
  digestTitle,
  periodDeltaFromHistory,
  spendInDigestWindow,
  digestNwSeries,
} from './digestPeriod'
import { downloadDigestPdf } from './digestPdf'

export type WeeklyDigestInput = {
  title?: string
  netWorth: number
  assets: number
  liabilities: number
  crypto: number
  equity: number
  /** NW change over ~7 days when available (legacy weekly field). */
  weekDelta?: number | null
  period?: DigestPeriod
  periodDelta?: number | null
  history?: DigestHistoryPoint[]
  spending?: DigestSpendEntry[]
  portfolios?: Array<{ name: string; netWorth: number }>
  highlights?: string[]
  generatedAt?: Date
  /** When true, mask £ amounts (privacy mode) */
  privacy?: boolean
}

export type { DigestPeriod, DigestPdfOrientation, DigestViewModel }
export {
  DIGEST_PERIODS,
  digestDeltaLabel,
  digestPeriodLabel,
  digestTitle,
  digestHtmlFilename,
  digestPdfFilename,
  digestNwSeries,
  periodDeltaFromHistory,
  dedupeHighlightLines,
  spendInDigestWindow,
} from './digestPeriod'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number, privacy?: boolean): string {
  if (privacy) return '••••'
  if (!Number.isFinite(n)) return '—'
  return formatGBP(n)
}

function formatDelta(n: number | null | undefined, privacy?: boolean): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (privacy) return '••••'
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatGBP(n)}`
}

function resolvePeriod(input: WeeklyDigestInput): DigestPeriod {
  return input.period ?? 'weekly'
}

function resolveDelta(input: WeeklyDigestInput, period: DigestPeriod, now: Date): number | null {
  if (input.history?.length) {
    return periodDeltaFromHistory(input.history, input.netWorth, period, now)
  }
  if (period === 'weekly') {
    if (input.periodDelta != null && Number.isFinite(input.periodDelta)) return input.periodDelta
    if (input.weekDelta != null && Number.isFinite(input.weekDelta)) return input.weekDelta
  }
  if (input.periodDelta != null && Number.isFinite(input.periodDelta)) return input.periodDelta
  return null
}

function windowCopy(period: DigestPeriod): string {
  return {
    daily: 'Rolling last 24 hours from now — not calendar-day-to-date.',
    weekly: 'Last 7 calendar days versus the latest priced point at or before that window.',
    monthly: 'Last 30 calendar days versus the latest priced point at or before that window.',
    quarterly: 'Last 90 calendar days versus the latest priced point at or before that window.',
    annual: 'Last 365 calendar days versus the latest priced point at or before that window.',
  }[period]
}

export function resolveDigestHighlights(
  input: WeeklyDigestInput,
  period: DigestPeriod,
  now = new Date(),
): string[] {
  const base = dedupeHighlightLines(input.highlights)
  const spent = spendInDigestWindow(input.spending, period, now)
  const spendLine =
    spent != null && spent > 0 && !input.privacy
      ? `${digestSpendLabel(period)} ${formatGBP(spent)}`
      : spent != null && spent > 0 && input.privacy
        ? `${digestSpendLabel(period)} ••••`
        : null
  const withoutSpend = base.filter((line) => !/^(week-to-date spend|spend \()/i.test(line))
  return dedupeHighlightLines(spendLine ? [...withoutSpend, spendLine] : withoutSpend)
}

export function buildDigestViewModel(
  input: WeeklyDigestInput,
  period: DigestPeriod = resolvePeriod(input),
  now = input.generatedAt ?? new Date(),
): DigestViewModel {
  const delta = resolveDelta({ ...input, period }, period, now)
  const series = digestNwSeries(input.history, input.netWorth, period, now)
  const slices = allocationSlices(input.equity, input.crypto).map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
    shareLabel: formatAllocationShare(s.share, input.privacy),
  }))
  const tone: DigestViewModel['deltaTone'] =
    delta == null ? 'missing' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const suppliedTitle = input.title?.trim()
  const title =
    !suppliedTitle || /^MyDSP (daily|weekly|monthly|quarterly|annual) digest$/i.test(suppliedTitle)
      ? digestTitle(period)
      : suppliedTitle

  return {
    period,
    title,
    generatedLabel: `Generated ${now.toLocaleString('en-GB')}`,
    windowCopy: windowCopy(period),
    netWorthLabel: money(input.netWorth, input.privacy),
    deltaLabel: digestDeltaLabel(period),
    deltaValue: formatDelta(delta, input.privacy),
    deltaTone: tone,
    assetsLabel: money(input.assets, input.privacy),
    liabilitiesLabel: money(input.liabilities, input.privacy),
    slices,
    series,
    seriesEmpty: series.length < 2,
    highlights: resolveDigestHighlights(input, period, now),
    portfolios: (input.portfolios ?? []).map((p) => ({
      name: p.name,
      valueLabel: money(p.netWorth, input.privacy),
    })),
    footer: `MyDSP · ${input.privacy ? 'amounts hidden (privacy on) · ' : ''}share or copy — no email is sent from the app.`,
  }
}

function toneClass(tone: DigestViewModel['deltaTone']): string {
  if (tone === 'down') return 'down'
  if (tone === 'up') return 'up'
  return ''
}

/** Inner HTML body for the digest (designed summary, not a table wall). */
export function buildWeeklyDigestContent(
  input: WeeklyDigestInput,
  period: DigestPeriod = resolvePeriod(input),
): string {
  const model = buildDigestViewModel(input, period, input.generatedAt ?? new Date())
  const donut = allocationDonutSvg(model.slices)
  const spark = nwSparklineSvg(model.series, {
    up: model.deltaTone === 'missing' ? null : model.deltaTone !== 'down',
  })
  const highlightList =
    model.highlights.length > 0
      ? `<ul class="digest-highlights">${model.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
      : '<p class="meta">No highlights for this window.</p>'
  const portfolioBlock =
    model.portfolios.length > 0
      ? `<div class="digest-ports">${model.portfolios
          .map((p) => `<div class="digest-port"><span>${escapeHtml(p.name)}</span><strong>${escapeHtml(p.valueLabel)}</strong></div>`)
          .join('')}</div>`
      : ''
  const sliceLegend =
    model.slices.length > 0
      ? model.slices
          .map(
            (s) =>
              `<span class="digest-leg"><i style="background:${s.color}"></i>${escapeHtml(s.name)} ${escapeHtml(s.shareLabel)}</span>`,
          )
          .join('')
      : '<span class="meta">Allocation —</span>'

  return `
    <h1>${escapeHtml(model.title)}</h1>
    <p class="meta">${escapeHtml(model.generatedLabel)} · paste into email if desired</p>
    <p class="meta">${escapeHtml(model.windowCopy)}</p>
    <div class="digest-kpis">
      <div class="digest-kpi">
        <span>Net worth</span>
        <strong>${escapeHtml(model.netWorthLabel)}</strong>
      </div>
      <div class="digest-kpi ${toneClass(model.deltaTone)}">
        <span>${escapeHtml(model.deltaLabel)}</span>
        <strong>${escapeHtml(model.deltaValue)}</strong>
      </div>
      <div class="digest-kpi">
        <span>Assets</span>
        <strong>${escapeHtml(model.assetsLabel)}</strong>
      </div>
      <div class="digest-kpi">
        <span>Liabilities</span>
        <strong>${escapeHtml(model.liabilitiesLabel)}</strong>
      </div>
    </div>
    <div class="digest-charts">
      <figure>
        <figcaption>Allocation</figcaption>
        ${donut}
        <div class="digest-legs">${sliceLegend}</div>
      </figure>
      <figure>
        <figcaption>Net worth</figcaption>
        ${spark}
        ${model.seriesEmpty ? '<p class="meta">No net-worth history in this window — Unpriced.</p>' : ''}
      </figure>
    </div>
    ${portfolioBlock}
    <h2>Highlights</h2>
    ${highlightList}
    <p class="meta">${escapeHtml(model.footer)}</p>
  `
}

function digestDocumentCss(): string {
  return `
    :root { color-scheme: light; }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 1.25rem;
      line-height: 1.45;
    }
    h1 { font-size: 1.35rem; margin: 0 0 .35rem; letter-spacing: -0.02em; color: #111; }
    h2 { font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; color: ${BTC_ORANGE}; margin: 1rem 0 .4rem; }
    .meta { font-size: .72rem; color: #6b6b6b; margin: .2rem 0; }
    .digest-kpis { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: .5rem; margin: .85rem 0; }
    @media (min-width: 720px) { .digest-kpis { grid-template-columns: repeat(4, minmax(0,1fr)); } }
    .digest-kpi {
      border: 1px solid ${BTC_ORANGE};
      background: #fff8f0;
      padding: .55rem .65rem;
      min-width: 0;
    }
    .digest-kpi span {
      display: block;
      font-size: .62rem;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: ${BTC_ORANGE};
    }
    .digest-kpi strong {
      display: block;
      font-size: .95rem;
      overflow-wrap: anywhere;
    }
    .digest-kpi.down strong { color: #ef4444; }
    .digest-kpi.up strong { color: ${BTC_ORANGE}; }
    .digest-charts { display: grid; grid-template-columns: 1fr; gap: .75rem; }
    @media (min-width: 720px) { .digest-charts { grid-template-columns: 10.5rem 1fr; align-items: center; } }
    figure { margin: 0; }
    figcaption { font-size: .62rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${BTC_ORANGE}; margin-bottom: .35rem; }
    .digest-legs { display: flex; flex-wrap: wrap; gap: .4rem .75rem; margin-top: .35rem; font-size: .75rem; }
    .digest-leg i { display: inline-block; width: .55rem; height: .55rem; margin-right: .3rem; }
    .digest-highlights { margin: .25rem 0 0; padding-left: 1.1rem; }
    .digest-ports { display: grid; gap: .3rem; margin: .6rem 0; }
    .digest-port { display: flex; justify-content: space-between; gap: .75rem; font-size: .85rem; border-bottom: 1px solid #eee; padding: .2rem 0; }
    @page { size: A4 landscape; margin: 12mm; }
  `
}

export function buildWeeklyDigestHtml(
  input: WeeklyDigestInput,
  period: DigestPeriod = resolvePeriod(input),
): string {
  const model = buildDigestViewModel(input, period, input.generatedAt ?? new Date())
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(model.title)}</title>
  <style>${digestDocumentCss()}</style>
</head>
<body>
  ${buildWeeklyDigestContent(input, period)}
</body>
</html>`
}

export function weeklyDigestFilename(
  input: WeeklyDigestInput,
  period: DigestPeriod = resolvePeriod(input),
): string {
  return digestHtmlFilename(period, input.generatedAt ?? new Date())
}

/** Trigger a browser download of the email-ready HTML file (desktop fallback). */
export function downloadWeeklyDigest(
  input: WeeklyDigestInput,
  period: DigestPeriod = resolvePeriod(input),
): void {
  downloadPdf(buildWeeklyDigestHtml(input, period), weeklyDigestFilename(input, period))
}

export function downloadWeeklyDigestPdf(
  input: WeeklyDigestInput,
  orientation: DigestPdfOrientation = 'landscape',
  period: DigestPeriod = resolvePeriod(input),
): void {
  const generatedAt = input.generatedAt ?? new Date()
  downloadDigestPdf(buildDigestViewModel(input, period, generatedAt), orientation, period, generatedAt)
}

export function canShareWeeklyDigest(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Prefer native share sheet on phone/tablet (avoids Safari “download HTML” dead-end).
 * Falls back to download when share is unavailable or aborted mid-flow.
 */
export async function shareWeeklyDigest(
  input: WeeklyDigestInput,
  period: DigestPeriod = resolvePeriod(input),
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const html = buildWeeklyDigestHtml(input, period)
  const name = weeklyDigestFilename(input, period)
  const blob = new Blob([html], { type: 'text/html' })
  const title = input.title ?? digestTitle(period)

  if (canShareWeeklyDigest()) {
    try {
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
        share: (data: ShareData) => Promise<void>
      }
      const file = new File([blob], name, { type: 'text/html' })
      const withFiles: ShareData = {
        files: [file],
        title,
        text: `MyDSP ${digestPeriodLabel(period).toLowerCase()} digest (HTML — paste into email if desired)`,
      }
      if (!nav.canShare || nav.canShare(withFiles)) {
        await nav.share(withFiles)
        return 'shared'
      }
      await nav.share({
        title,
        text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1800),
      })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    }
  }

  downloadWeeklyDigest(input, period)
  return 'downloaded'
}

/** Copy digest HTML to clipboard for paste into Mail. */
export async function copyWeeklyDigestHtml(
  input: WeeklyDigestInput,
  period: DigestPeriod = resolvePeriod(input),
): Promise<boolean> {
  try {
    const html = buildWeeklyDigestHtml(input, period)
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(html)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/** Approximate 7-day NW delta from history (latest vs ~7 days ago). */
export function weekDeltaFromHistory(
  history: Array<{ date: string; netWorth: number }>,
  currentNetWorth: number,
  now = new Date(),
): number | null {
  return periodDeltaFromHistory(history, currentNetWorth, 'weekly', now)
}

export function digestWindowStartMs(period: DigestPeriod, now = new Date()): number {
  return digestCutoffMs(period, now)
}
