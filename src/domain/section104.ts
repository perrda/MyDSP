/** UK CGT section 104 share pooling — same-day / B&B / §104 matching. */

import type { Disposal, JournalEntry } from './types'
import { getDisposalsForYear } from './cgt'
import { formatGBP, formatGBPPrecise } from '../utils/format'

export interface PoolLot {
  symbol: string
  assetType: 'crypto' | 'equity'
  qty: number
  pooledCost: number
}

export interface MatchedDisposal {
  disposal: Disposal
  matchedRule: 'same-day' | 'bed-and-breakfast' | 'section-104' | 'unpooled'
  allowableCost: number
  gain: number
  note: string
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

function inferAssetType(asset: string): 'crypto' | 'equity' {
  const a = asset.toUpperCase()
  const cryptoish = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'AVAX', 'LINK', 'DOGE', 'MATIC']
  if (cryptoish.includes(a) || a.includes('-USD') || a.endsWith('USDT')) return 'crypto'
  return 'equity'
}

function buyCost(j: JournalEntry): number {
  return j.total > 0 ? j.total : j.qty * j.price + (j.fees || 0)
}

export function buildPoolsFromJournal(journal: JournalEntry[]): Map<string, PoolLot> {
  const pools = new Map<string, PoolLot>()
  const buys = [...journal]
    .filter((j) => String(j.type).toLowerCase() === 'buy')
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const j of buys) {
    const symbol = j.asset.trim().toUpperCase()
    if (!symbol || !(j.qty > 0)) continue
    const assetType = inferAssetType(symbol)
    const key = `${assetType}:${symbol}`
    const cost = buyCost(j)
    const pool = pools.get(key) ?? { symbol, assetType, qty: 0, pooledCost: 0 }
    pool.qty += j.qty
    pool.pooledCost += cost
    pools.set(key, pool)
  }
  return pools
}

/** Suggest disposals from journal sells using §104 pooled cost. */
export function suggestDisposalsFromJournal(
  journal: JournalEntry[],
  existing: Disposal[],
): Disposal[] {
  const pools = buildPoolsFromJournal(journal)
  const sells = [...journal]
    .filter((j) => String(j.type).toLowerCase() === 'sell')
    .sort((a, b) => a.date.localeCompare(b.date))

  const existingKeys = new Set(
    existing.map((d) => `${d.date}|${d.symbol}|${d.qty}|${d.proceeds}`),
  )
  const out: Disposal[] = []
  let nextId = existing.reduce((m, d) => Math.max(m, d.id), 0) + 1

  for (const j of sells) {
    const symbol = j.asset.trim().toUpperCase()
    if (!symbol || !(j.qty > 0)) continue
    const assetType = inferAssetType(symbol)
    const key = `${assetType}:${symbol}`
    const pool = pools.get(key)
    const proceeds = j.total > 0 ? j.total : j.qty * j.price - (j.fees || 0)
    let cost = 0
    if (pool && pool.qty > 0) {
      const unit = pool.pooledCost / pool.qty
      const take = Math.min(j.qty, pool.qty)
      cost = unit * take
      pool.qty -= take
      pool.pooledCost = Math.max(0, pool.pooledCost - cost)
      pools.set(key, pool)
    } else {
      cost = j.qty * j.price
    }
    const stamp = `${j.date.slice(0, 10)}|${symbol}|${j.qty}|${proceeds}`
    if (existingKeys.has(stamp)) continue
    out.push({
      id: nextId++,
      date: j.date.slice(0, 10),
      assetType,
      symbol,
      qty: j.qty,
      proceeds,
      cost,
    })
  }
  return out
}

/**
 * Match disposals with HMRC order:
 * 1) Same-day acquisitions
 * 2) Bed-and-breakfast (buys within 30 days after disposal)
 * 3) §104 pool (buys on/before disposal date)
 */
export function matchDisposalsSection104(
  disposals: Disposal[],
  taxYear: string,
  journal: JournalEntry[] = [],
): MatchedDisposal[] {
  const year = getDisposalsForYear(disposals, taxYear).sort((a, b) => a.date.localeCompare(b.date))

  type Lot = { symbol: string; assetType: 'crypto' | 'equity'; date: string; qty: number; cost: number }
  const lots: Lot[] = journal
    .filter((j) => String(j.type).toLowerCase() === 'buy' && j.qty > 0)
    .map((j) => ({
      symbol: j.asset.trim().toUpperCase(),
      assetType: inferAssetType(j.asset),
      date: j.date.slice(0, 10),
      qty: j.qty,
      cost: buyCost(j),
    }))

  const consume = (
    pred: (b: Lot) => boolean,
    needQty: number,
  ): { qty: number; cost: number } => {
    let left = needQty
    let cost = 0
    let taken = 0
    for (const b of lots) {
      if (left <= 0) break
      if (!pred(b) || b.qty <= 0) continue
      const take = Math.min(left, b.qty)
      const unit = b.qty > 0 ? b.cost / b.qty : 0
      cost += unit * take
      b.qty -= take
      b.cost = Math.max(0, b.cost - unit * take)
      left -= take
      taken += take
    }
    return { qty: taken, cost }
  }

  const out: MatchedDisposal[] = []

  for (const d of year) {
    const symbol = d.symbol.toUpperCase()
    let remaining = d.qty
    let allowableCost = 0
    let matchedRule: MatchedDisposal['matchedRule'] = 'unpooled'
    const notes: string[] = []

    const same = consume(
      (b) => b.symbol === symbol && b.assetType === d.assetType && b.date === d.date,
      remaining,
    )
    if (same.qty > 0) {
      allowableCost += same.cost
      remaining -= same.qty
      matchedRule = 'same-day'
      notes.push(`Same-day ${same.qty.toFixed(6)} cost ${same.cost.toFixed(2)}`)
    }

    if (remaining > 0) {
      const bb = consume((b) => {
        if (b.symbol !== symbol || b.assetType !== d.assetType) return false
        const days = daysBetween(d.date, b.date)
        return days > 0 && days <= 30
      }, remaining)
      if (bb.qty > 0) {
        allowableCost += bb.cost
        remaining -= bb.qty
        if (matchedRule === 'unpooled') matchedRule = 'bed-and-breakfast'
        notes.push(`B&B ${bb.qty.toFixed(6)} cost ${bb.cost.toFixed(2)}`)
      }
    }

    if (remaining > 0) {
      const poolQty = lots
        .filter((b) => b.symbol === symbol && b.assetType === d.assetType && b.date <= d.date)
        .reduce((s, b) => s + b.qty, 0)
      const poolCost = lots
        .filter((b) => b.symbol === symbol && b.assetType === d.assetType && b.date <= d.date)
        .reduce((s, b) => s + b.cost, 0)
      if (poolQty > 0) {
        const unit = poolCost / poolQty
        const take = Math.min(remaining, poolQty)
        const cost = unit * take
        allowableCost += cost
        remaining -= take
        if (matchedRule === 'unpooled') matchedRule = 'section-104'
        notes.push(`§104 ${take.toFixed(6)} @ avg ${unit.toFixed(4)}`)
        let left = take
        for (const b of lots) {
          if (left <= 0) break
          if (b.symbol !== symbol || b.assetType !== d.assetType || b.date > d.date || b.qty <= 0) {
            continue
          }
          const t = Math.min(left, b.qty)
          const u = b.qty > 0 ? b.cost / b.qty : 0
          b.qty -= t
          b.cost = Math.max(0, b.cost - u * t)
          left -= t
        }
      }
    }

    if (remaining > 0) {
      const unit = d.qty > 0 ? d.cost / d.qty : 0
      allowableCost += unit * remaining
      if (notes.length === 0) {
        notes.push(d.cost > 0 ? 'Used entered disposal cost.' : 'No matching acquisitions.')
      } else {
        notes.push(`Remainder ${remaining.toFixed(6)} used entered cost.`)
      }
    }

    if (notes.length === 0) notes.push('No matching acquisitions found.')

    out.push({
      disposal: d,
      matchedRule,
      allowableCost,
      gain: d.proceeds - allowableCost,
      note: notes.join(' · '),
    })
  }

  return out
}

export function section104Summary(
  disposals: Disposal[],
  taxYear: string,
  journal: JournalEntry[] = [],
) {
  const matched = matchDisposalsSection104(disposals, taxYear, journal)
  const byRule = {
    sameDay: matched.filter((m) => m.matchedRule === 'same-day').length,
    bedAndBreakfast: matched.filter((m) => m.matchedRule === 'bed-and-breakfast').length,
    section104: matched.filter((m) => m.matchedRule === 'section-104').length,
    unpooled: matched.filter((m) => m.matchedRule === 'unpooled').length,
  }
  return { matched, byRule }
}

export function exportCgtCsv(
  disposals: Disposal[],
  taxYear: string,
  journal: JournalEntry[] = [],
): string {
  const matched = matchDisposalsSection104(disposals, taxYear, journal)
  if (matched.length === 0) {
    return 'date,symbol,type,qty,proceeds,cost,gain,rule,note\n# No disposals for this tax year\n'
  }
  const header = 'date,symbol,type,qty,proceeds,cost,gain,rule,note\n'
  const body = matched
    .map((m) =>
      [
        m.disposal.date,
        m.disposal.symbol,
        m.disposal.assetType,
        m.disposal.qty.toFixed(8).replace(/\.?0+$/, ''), // Trim trailing zeros
        m.disposal.proceeds.toFixed(2),
        m.allowableCost.toFixed(2),
        m.gain.toFixed(2),
        m.matchedRule,
        `"${m.note.replace(/"/g, '""')}"`,
      ].join(','),
    )
    .join('\n')
  return header + body + '\n'
}

/** HMRC SA108-style tabular export (simplified Box 1–8 style columns). */
export function exportSa108Csv(
  disposals: Disposal[],
  taxYear: string,
  journal: JournalEntry[] = [],
): string {
  const matched = matchDisposalsSection104(disposals, taxYear, journal)
  if (matched.length === 0) {
    return 'tax_year,box_description,disposal_date,asset,quantity,proceeds_box5,costs_box6,gains_box7,losses_box8,matching_rule\n# No disposals for this tax year\n'
  }
  const header =
    'tax_year,box_description,disposal_date,asset,quantity,proceeds_box5,costs_box6,gains_box7,losses_box8,matching_rule\n'
  const body = matched
    .map((m) => {
      const g = m.gain
      return [
        taxYear,
        `"${m.disposal.symbol} ${m.disposal.assetType}"`,
        m.disposal.date,
        m.disposal.symbol,
        m.disposal.qty.toFixed(8).replace(/\.?0+$/, ''), // Trim trailing zeros
        m.disposal.proceeds.toFixed(2),
        m.allowableCost.toFixed(2),
        g >= 0 ? g.toFixed(2) : '0.00',
        g < 0 ? Math.abs(g).toFixed(2) : '0.00',
        m.matchedRule,
      ].join(',')
    })
    .join('\n')
  
  // Add summary row
  const totalProceeds = matched.reduce((s, m) => s + m.disposal.proceeds, 0)
  const totalCosts = matched.reduce((s, m) => s + m.allowableCost, 0)
  const totalGains = matched.reduce((s, m) => s + Math.max(0, m.gain), 0)
  const totalLosses = matched.reduce((s, m) => s + Math.abs(Math.min(0, m.gain)), 0)
  const summary = `# Summary,Total,,,${totalProceeds.toFixed(2)},${totalCosts.toFixed(2)},${totalGains.toFixed(2)},${totalLosses.toFixed(2)},\n`
  
  return header + body + '\n' + summary
}

/** Printable HTML CGT report (use with window.print / Save as PDF). */
export function buildCgtReportHtml(
  disposals: Disposal[],
  taxYear: string,
  journal: JournalEntry[],
  summary: {
    netGain: number
    allowance: number
    taxableGain: number
    cgtDue: number
  },
): string {
  const matched = matchDisposalsSection104(disposals, taxYear, journal)
  if (matched.length === 0) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>MyDSP CGT ${taxYear}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;padding:2rem;max-width:900px;margin:0 auto}
</style>
</head>
<body>
  <h1>UK Capital Gains — ${taxYear}</h1>
  <p>No disposals for this tax year.</p>
</body>
</html>`
  }
  const rows = matched
    .map(
      (m) =>
        `<tr>
          <td>${m.disposal.date}</td>
          <td>${m.disposal.symbol}</td>
          <td>${m.matchedRule}</td>
          <td style="text-align:right">${formatGBPPrecise(m.disposal.proceeds)}</td>
          <td style="text-align:right">${formatGBPPrecise(m.allowableCost)}</td>
          <td style="text-align:right">${formatGBPPrecise(m.gain)}</td>
        </tr>`,
    )
    .join('')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>MyDSP CGT ${taxYear}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;padding:2rem;max-width:900px;margin:0 auto}
  h1{font-size:1.5rem;margin:0 0 .25rem}
  .meta{color:#555;margin-bottom:1.5rem}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{border-bottom:1px solid #ddd;padding:.5rem .4rem;text-align:left}
  th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#666}
  .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin:1.5rem 0}
  .sum div{border:1px solid #e5e5e5;padding:1rem}
  .sum strong{display:block;font-size:1.25rem;margin-top:.35rem}
  .warning{background:#fef3c7;border-left:4px solid #f59e0b;padding:1rem;margin:1.5rem 0}
  @media print{body{padding:0} .noprint{display:none} .warning{border-color:#ccc}}
</style>
</head>
<body>
  <p class="noprint"><button onclick="window.print()">Print / Save as PDF</button></p>
  <h1>UK Capital Gains — ${taxYear}</h1>
  <p class="meta">MyDSP SA108-style summary · Generated ${new Date().toISOString().slice(0, 10)}</p>
  <div class="warning">
    <strong>⚠️ Important:</strong> This report uses UK HMRC rules (§104 pooling, same-day, B&amp;B). 
    Not formal tax advice. Verify with a qualified tax advisor before filing SA108.
  </div>
  <div class="sum">
    <div>Net gain<strong>${formatGBP(summary.netGain)}</strong></div>
    <div>Allowance<strong>${formatGBP(summary.allowance)}</strong></div>
    <div>Taxable<strong>${formatGBP(summary.taxableGain)}</strong></div>
    <div>Est. CGT @20%<strong>${formatGBP(summary.cgtDue)}</strong></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Asset</th><th>Rule</th><th>Proceeds</th><th>Cost</th><th>Gain</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="meta" style="margin-top:2rem">
    Matching rules: Same-day = acquisitions on disposal date · B&amp;B = acquisitions within 30 days after disposal · 
    §104 = pooled average cost from earlier acquisitions · Unpooled = manual disposal cost entry
  </p>
</body>
</html>`
}

/**
 * Export detailed transaction log with acquisition and disposal details.
 * Useful for personal records and audit trail.
 */
export function exportTransactionLog(
  disposals: Disposal[],
  taxYear: string,
  journal: JournalEntry[] = [],
): string {
  const matched = matchDisposalsSection104(disposals, taxYear, journal)
  const header = 'disposal_date,symbol,type,qty_sold,unit_proceeds,total_proceeds,matching_rule,allowable_cost_per_unit,total_allowable_cost,gain_loss,notes\n'
  
  const body = matched
    .map((m) => {
      const unitProceeds = m.disposal.qty > 0 ? m.disposal.proceeds / m.disposal.qty : 0
      const unitCost = m.disposal.qty > 0 ? m.allowableCost / m.disposal.qty : 0
      
      return [
        m.disposal.date,
        m.disposal.symbol,
        m.disposal.assetType,
        m.disposal.qty.toFixed(8).replace(/\.?0+$/, ''),
        unitProceeds.toFixed(4),
        m.disposal.proceeds.toFixed(2),
        m.matchedRule,
        unitCost.toFixed(4),
        m.allowableCost.toFixed(2),
        m.gain.toFixed(2),
        `"${m.note.replace(/"/g, '""')}"`,
      ].join(',')
    })
    .join('\n')
  
  if (matched.length === 0) {
    return header + '# No disposals for this tax year\n'
  }
  
  return header + body + '\n'
}
