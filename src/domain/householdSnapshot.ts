/** One-page printable/shareable household NW + allocation snapshot. */

import { formatGBP } from '../utils/format'
import { generatePdfHtml, printPdf } from '../utils/exportFormats'

export interface HouseholdSnapshotInput {
  title?: string
  netWorth: number
  assets: number
  liabilities: number
  crypto: number
  equity: number
  portfolios?: Array<{ name: string; netWorth: number }>
  generatedAt?: Date
}

export function buildHouseholdSnapshotContent(input: HouseholdSnapshotInput): string {
  const {
    title = 'Household snapshot',
    netWorth,
    assets,
    liabilities,
    crypto,
    equity,
    portfolios = [],
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

  return `
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Generated ${generatedAt.toLocaleString('en-GB')}</p>
    <h2>Net worth</h2>
    <table>
      <tbody>
        <tr><th>Net worth</th><td><strong>${formatGBP(netWorth)}</strong></td></tr>
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
  `
}

export function buildHouseholdSnapshotHtml(input: HouseholdSnapshotInput): string {
  return generatePdfHtml(buildHouseholdSnapshotContent(input), {
    title: input.title ?? 'Household snapshot',
    includeDate: true,
  })
}

export function printHouseholdSnapshot(input: HouseholdSnapshotInput): void {
  printPdf(buildHouseholdSnapshotHtml(input))
}

export async function shareHouseholdSnapshot(
  input: HouseholdSnapshotInput,
): Promise<'shared' | 'printed' | 'cancelled'> {
  const html = buildHouseholdSnapshotHtml(input)
  const title = input.title ?? 'Household snapshot'
  const text = [
    title,
    `Net worth: ${formatGBP(input.netWorth)}`,
    `Assets: ${formatGBP(input.assets)} · Debt: ${formatGBP(input.liabilities)}`,
    `Equities: ${formatGBP(input.equity)} · Crypto: ${formatGBP(input.crypto)}`,
  ].join('\n')

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([html], 'mydsp-household-snapshot.html', {
        type: 'text/html',
      })
      const canFiles =
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      if (canFiles) {
        await navigator.share({ title, text, files: [file] })
        return 'shared'
      }
      await navigator.share({ title, text })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
      /* fall through to print */
    }
  }

  printPdf(html)
  return 'printed'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
