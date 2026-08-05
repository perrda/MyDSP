export interface Disposal {
  id: number
  date: string
  assetType: 'crypto' | 'equity'
  symbol: string
  qty: number
  proceeds: number
  cost: number
}

export const CGT_ALLOWANCES: Record<string, number> = {
  '2026/27': 3000,
  '2025/26': 3000,
  '2024/25': 3000,
  '2023/24': 6000,
  '2022/23': 12300,
  '2021/22': 12300,
  '2020/21': 12300,
}

/** UK tax year label (6 Apr → 5 Apr). */
export function getCurrentTaxYear(now = new Date()): string {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  if (month < 4 || (month === 4 && day < 6)) {
    return `${year - 1}/${String(year).slice(2)}`
  }
  return `${year}/${String(year + 1).slice(2)}`
}

export function getTaxYearRange(taxYear: string): { start: Date; end: Date } {
  const startYear = parseInt(taxYear.split('/')[0], 10)
  // Local calendar bounds (not UTC) so UK tax year edges are stable.
  const start = new Date(startYear, 3, 6, 0, 0, 0, 0)
  const end = new Date(startYear + 1, 3, 5, 23, 59, 59, 999)
  return { start, end }
}

/** Parse YYYY-MM-DD (or full ISO) as a local calendar date — avoid UTC midnight shifts. */
export function parseDisposalDate(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || '').trim())
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
  }
  return new Date(dateStr)
}

export function getDisposalsForYear(disposals: Disposal[], taxYear: string): Disposal[] {
  const { start, end } = getTaxYearRange(taxYear)
  return disposals.filter((d) => {
    const date = parseDisposalDate(d.date)
    if (Number.isNaN(date.getTime())) return false
    return date >= start && date <= end
  })
}

/** Gain/loss on a single disposal (proceeds − cost). */
export function gain(d: Pick<Disposal, 'proceeds' | 'cost'>): number {
  return d.proceeds - d.cost
}

export interface TaxSummary {
  allowance: number
  totalGains: number
  totalLosses: number
  netGain: number
  taxableGain: number
  cgtDue: number
  disposals: Disposal[]
}

/**
 * Simplified UK CGT: (gains − losses − allowance) × 20%.
 * Prefer calcTaxSummaryFromMatched when §104 matching is available.
 */
export function calcTaxSummary(disposals: Disposal[], taxYear: string): TaxSummary {
  const yearDisposals = getDisposalsForYear(disposals, taxYear)
  const allowance = CGT_ALLOWANCES[taxYear] ?? 3000
  let totalGains = 0
  let totalLosses = 0
  for (const d of yearDisposals) {
    const g = gain(d)
    if (g >= 0) totalGains += g
    else totalLosses += Math.abs(g)
  }
  const netGain = totalGains - totalLosses
  const taxableGain = Math.max(0, netGain - allowance)
  const cgtDue = taxableGain * 0.2
  return { allowance, totalGains, totalLosses, netGain, taxableGain, cgtDue, disposals: yearDisposals }
}

/** Tax summary using §104 / same-day / B&B allowable costs. */
export function calcTaxSummaryFromMatched(
  matched: { gain: number; disposal: Disposal }[],
  taxYear: string,
): TaxSummary {
  const allowance = CGT_ALLOWANCES[taxYear] ?? 3000
  let totalGains = 0
  let totalLosses = 0
  for (const m of matched) {
    if (m.gain >= 0) totalGains += m.gain
    else totalLosses += Math.abs(m.gain)
  }
  const netGain = totalGains - totalLosses
  const taxableGain = Math.max(0, netGain - allowance)
  const cgtDue = taxableGain * 0.2
  return {
    allowance,
    totalGains,
    totalLosses,
    netGain,
    taxableGain,
    cgtDue,
    disposals: matched.map((m) => ({
      ...m.disposal,
      cost: m.disposal.proceeds - m.gain,
    })),
  }
}
