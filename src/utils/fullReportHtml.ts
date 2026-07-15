/** Build multi-section HTML for the full financial PDF report. */

import { formatGBP } from './format'

/** Minimal portfolio shape used by the full report (avoids circular imports). */
export type FullReportData = {
  history?: Array<{ netWorth?: number }>
  crypto?: Array<{ symbol: string; qty: number; price: number }>
  equities?: Array<{ symbol: string; shares: number; livePrice: number }>
  spending?: Array<{ date: string; description: string; category: string; amount: number }>
  goals?: Array<{ name: string; target: number; deadline: string; type: string; startVal?: number }>
  creditCards?: Array<{ name: string; balance: number }>
  loans?: Array<{ name: string; balance: number }>
  settings?: { taxResidency?: string }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildFullReportHtml(data: FullReportData): string {
  const netWorth = data.history?.[data.history.length - 1]?.netWorth
  const crypto = data.crypto ?? []
  const equities = data.equities ?? []
  const spending = data.spending ?? []
  const goals = data.goals ?? []
  const cards = data.creditCards ?? []
  const loans = data.loans ?? []
  const residency = data.settings?.taxResidency || 'GB'

  const spendingByCategory = new Map<string, number>()
  for (const s of spending) {
    const cat = s.category || 'other'
    spendingByCategory.set(cat, (spendingByCategory.get(cat) ?? 0) + s.amount)
  }
  const categoryRows = [...spendingByCategory.entries()].sort((a, b) => b[1] - a[1])
  const recent = [...spending].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25)
  const recentTotal = recent.reduce((sum, s) => sum + s.amount, 0)
  const liabTotal =
    cards.reduce((sum, c) => sum + c.balance, 0) + loans.reduce((sum, l) => sum + l.balance, 0)

  return `
    <h1>Full Financial Report</h1>
    <p>Net worth: ${netWorth != null ? formatGBP(netWorth) : 'N/A'}</p>

    <h2>Portfolio summary</h2>
    <h3>Crypto</h3>
    <table>
      <thead><tr><th>Symbol</th><th>Quantity</th><th>Value</th></tr></thead>
      <tbody>
        ${
          crypto.length
            ? crypto
                .map(
                  (c) => `
          <tr>
            <td>${escapeHtml(c.symbol)}</td>
            <td>${c.qty}</td>
            <td>${formatGBP(c.qty * c.price)}</td>
          </tr>`,
                )
                .join('')
            : '<tr><td colspan="3">No crypto holdings</td></tr>'
        }
      </tbody>
    </table>
    <h3>Equities</h3>
    <table>
      <thead><tr><th>Symbol</th><th>Shares</th><th>Value</th></tr></thead>
      <tbody>
        ${
          equities.length
            ? equities
                .map(
                  (e) => `
          <tr>
            <td>${escapeHtml(e.symbol)}</td>
            <td>${e.shares}</td>
            <td>${formatGBP(e.shares * e.livePrice)}</td>
          </tr>`,
                )
                .join('')
            : '<tr><td colspan="3">No equity holdings</td></tr>'
        }
      </tbody>
    </table>

    <h2>Spending</h2>
    <p>Recent ${recent.length} transactions: ${formatGBP(recentTotal)}</p>
    <h3>Totals by category</h3>
    <table>
      <thead><tr><th>Category</th><th>Total</th></tr></thead>
      <tbody>
        ${
          categoryRows.length
            ? categoryRows
                .map(
                  ([cat, total]) => `
          <tr>
            <td>${escapeHtml(cat)}</td>
            <td>${formatGBP(total)}</td>
          </tr>`,
                )
                .join('')
            : '<tr><td colspan="2">No spending</td></tr>'
        }
      </tbody>
    </table>

    <h2>Goals progress</h2>
    <table>
      <thead><tr><th>Goal</th><th>Target</th><th>Start</th><th>Deadline</th><th>Type</th></tr></thead>
      <tbody>
        ${
          goals.length
            ? goals
                .map(
                  (g) => `
          <tr>
            <td>${escapeHtml(g.name)}</td>
            <td>${formatGBP(g.target)}</td>
            <td>${g.startVal != null ? formatGBP(g.startVal) : '—'}</td>
            <td>${escapeHtml(g.deadline)}</td>
            <td>${escapeHtml(g.type)}</td>
          </tr>`,
                )
                .join('')
            : '<tr><td colspan="5">No goals</td></tr>'
        }
      </tbody>
    </table>

    <h2>Liabilities</h2>
    <p>Total balances: ${formatGBP(liabTotal)}</p>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Balance</th></tr></thead>
      <tbody>
        ${
          cards.length || loans.length
            ? [
                ...cards.map(
                  (c) => `
          <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>Credit card</td>
            <td>${formatGBP(c.balance)}</td>
          </tr>`,
                ),
                ...loans.map(
                  (l) => `
          <tr>
            <td>${escapeHtml(l.name)}</td>
            <td>Loan</td>
            <td>${formatGBP(l.balance)}</td>
          </tr>`,
                ),
              ].join('')
            : '<tr><td colspan="3">No liabilities</td></tr>'
        }
      </tbody>
    </table>

    <h2>Tax residency</h2>
    <p>Current tax residency code: <strong>${escapeHtml(residency)}</strong>. Simplified CGT estimates on the Tax page use this pack. Not formal tax advice.</p>
  `
}
