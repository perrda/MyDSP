/** Download-only weekly email-ready HTML digest (no backend mailer). */

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
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDelta(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
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
              `<tr><td>${escapeHtml(p.name)}</td><td>${formatGBP(p.netWorth)}</td></tr>`,
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
      <strong>Net worth ${formatGBP(netWorth)}</strong>
      · Week Δ ${formatDelta(weekDelta)}
    </p>
    <h2>Net worth summary</h2>
    <table>
      <tbody>
        <tr><th>Net worth</th><td><strong>${formatGBP(netWorth)}</strong></td></tr>
        <tr><th>Week change</th><td>${formatDelta(weekDelta)}</td></tr>
        <tr><th>Assets</th><td>${formatGBP(assets)}</td></tr>
        <tr><th>Liabilities</th><td>${formatGBP(liabilities)}</td></tr>
      </tbody>
    </table>
    <h2>Allocation</h2>
    <table>
      <thead><tr><th>Sleeve</th><th>Value</th><th>Share</th></tr></thead>
      <tbody>
        <tr><td>Equities</td><td>${formatGBP(equity)}</td><td>${equityPct}%</td></tr>
        <tr><td>Crypto</td><td>${formatGBP(crypto)}</td><td>${cryptoPct}%</td></tr>
      </tbody>
    </table>
    ${portfolioRows}
    ${highlightList}
    <p class="meta">MyDSP · local download only — no email is sent from the app.</p>
  `
}

export function buildWeeklyDigestHtml(input: WeeklyDigestInput): string {
  return generatePdfHtml(buildWeeklyDigestContent(input), {
    title: input.title ?? 'MyDSP weekly digest',
    includeDate: true,
  })
}

/** Trigger a browser download of the email-ready HTML file. */
export function downloadWeeklyDigest(input: WeeklyDigestInput): void {
  const stamp = (input.generatedAt ?? new Date()).toISOString().slice(0, 10)
  downloadPdf(buildWeeklyDigestHtml(input), `mydsp-weekly-digest-${stamp}.html`)
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
