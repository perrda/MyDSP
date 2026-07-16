/** Weekly email-ready HTML digest — preview / share on mobile, download on desktop. */

import { formatGBP } from '../utils/format'
import { downloadPdf, generatePdfHtml } from '../utils/exportFormats'

export type WeeklyDigestInput = {
  title?: string
  netWorth: number
  assets: number
  liabilities: number
  crypto: number
  equity: number
  /** NW change over ~7 days when available */
  weekDelta?: number | null
  portfolios?: Array<{ name: string; netWorth: number }>
  highlights?: string[]
  generatedAt?: Date
  /** When true, mask £ amounts (privacy mode) */
  privacy?: boolean
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number, privacy?: boolean): string {
  if (privacy) return '••••'
  return formatGBP(n)
}

function formatDelta(n: number | null | undefined, privacy?: boolean): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (privacy) return '••••'
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatGBP(n)}`
}

/** Inner HTML body for the weekly digest. */
export function buildWeeklyDigestContent(input: WeeklyDigestInput): string {
  const {
    title = 'MyDSP weekly digest',
    netWorth,
    assets,
    liabilities,
    crypto,
    equity,
    weekDelta = null,
    portfolios = [],
    highlights = [],
    generatedAt = new Date(),
    privacy = false,
  } = input

  const investable = crypto + equity
  const cryptoPct = investable > 0 ? Math.round((crypto / investable) * 100) : 0
  const equityPct = investable > 0 ? Math.round((equity / investable) * 100) : 0

  const portfolioRows =
    portfolios.length > 0
      ? `
    <h2>Portfolios</h2>
    <table>
      <thead><tr><th>Name</th><th>Net worth</th></tr></thead>
      <tbody>
        ${portfolios
          .map(
            (p) =>
              `<tr><td>${escapeHtml(p.name)}</td><td>${money(p.netWorth, privacy)}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>`
      : ''

  const highlightList =
    highlights.length > 0
      ? `
    <h2>Highlights</h2>
    <ul>
      ${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
    </ul>`
      : ''

  return `
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Generated ${generatedAt.toLocaleString('en-GB')} · paste into email if desired</p>
    <p class="summary-card">
      <strong>Net worth ${money(netWorth, privacy)}</strong>
      · Week Δ ${formatDelta(weekDelta, privacy)}
    </p>
    <h2>Net worth summary</h2>
    <table>
      <tbody>
        <tr><th>Net worth</th><td><strong>${money(netWorth, privacy)}</strong></td></tr>
        <tr><th>Week change</th><td>${formatDelta(weekDelta, privacy)}</td></tr>
        <tr><th>Assets</th><td>${money(assets, privacy)}</td></tr>
        <tr><th>Liabilities</th><td>${money(liabilities, privacy)}</td></tr>
      </tbody>
    </table>
    <h2>Allocation</h2>
    <table>
      <thead><tr><th>Sleeve</th><th>Value</th><th>Share</th></tr></thead>
      <tbody>
        <tr><td>Equities</td><td>${money(equity, privacy)}</td><td>${equityPct}%</td></tr>
        <tr><td>Crypto</td><td>${money(crypto, privacy)}</td><td>${cryptoPct}%</td></tr>
      </tbody>
    </table>
    ${portfolioRows}
    ${highlightList}
    <p class="meta">MyDSP · ${privacy ? 'amounts hidden (privacy on) · ' : ''}share or copy — no email is sent from the app.</p>
  `
}

export function buildWeeklyDigestHtml(input: WeeklyDigestInput): string {
  return generatePdfHtml(buildWeeklyDigestContent(input), {
    title: input.title ?? 'MyDSP weekly digest',
    includeDate: true,
  })
}

export function weeklyDigestFilename(input: WeeklyDigestInput): string {
  const stamp = (input.generatedAt ?? new Date()).toISOString().slice(0, 10)
  return `mydsp-weekly-digest-${stamp}.html`
}

/** Trigger a browser download of the email-ready HTML file (desktop fallback). */
export function downloadWeeklyDigest(input: WeeklyDigestInput): void {
  downloadPdf(buildWeeklyDigestHtml(input), weeklyDigestFilename(input))
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
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const html = buildWeeklyDigestHtml(input)
  const name = weeklyDigestFilename(input)
  const blob = new Blob([html], { type: 'text/html' })

  if (canShareWeeklyDigest()) {
    try {
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
        share: (data: ShareData) => Promise<void>
      }
      const file = new File([blob], name, { type: 'text/html' })
      const withFiles: ShareData = {
        files: [file],
        title: input.title ?? 'MyDSP weekly digest',
        text: 'MyDSP weekly net-worth digest (HTML — paste into email if desired)',
      }
      if (!nav.canShare || nav.canShare(withFiles)) {
        await nav.share(withFiles)
        return 'shared'
      }
      // Some iOS builds reject HTML files — share text + URL object as last resort
      await nav.share({
        title: input.title ?? 'MyDSP weekly digest',
        text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1800),
      })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
      /* fall through to download */
    }
  }

  downloadWeeklyDigest(input)
  return 'downloaded'
}

/** Copy digest HTML to clipboard for paste into Mail. */
export async function copyWeeklyDigestHtml(input: WeeklyDigestInput): Promise<boolean> {
  try {
    const html = buildWeeklyDigestHtml(input)
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
  if (!history.length) return null
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
  const y = cutoff.getFullYear()
  const m = String(cutoff.getMonth() + 1).padStart(2, '0')
  const d = String(cutoff.getDate()).padStart(2, '0')
  const cutoffKey = `${y}-${m}-${d}`

  const prior = [...history]
    .filter((h) => h.date && h.date <= cutoffKey && Number.isFinite(h.netWorth))
    .sort((a, b) => a.date.localeCompare(b.date))
  const baseline = prior[prior.length - 1]
  if (!baseline) return null
  return currentNetWorth - baseline.netWorth
}
