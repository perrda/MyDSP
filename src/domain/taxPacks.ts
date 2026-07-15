/** Simplified capital-gains jurisdiction packs (reference rates — not tax advice). */

import {
  CGT_ALLOWANCES,
  calcTaxSummaryFromMatched,
  getCurrentTaxYear,
  type Disposal,
  type TaxSummary,
} from './cgt'

export type TaxYearKind = 'uk-apr' | 'calendar'
export type TaxMatching = 'uk-section104' | 'fifo-simple' | 'none'

export interface TaxJurisdictionPack {
  code: string
  label: string
  yearKind: TaxYearKind
  matching: TaxMatching
  /** Flat simplified CGT / LTCG rate (0–1). */
  rate: number
  /** Year key → annual allowance / exclusion (display currency units). */
  allowances: Record<string, number>
  /** False for jurisdictions with no personal CGT (e.g. SG, TH). */
  hasCgt: boolean
  disclaimer: string
}

const CALENDAR_YEARS = ['2026', '2025', '2024', '2023', '2022'] as const

function calendarAllowances(amount: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const y of CALENDAR_YEARS) out[y] = amount
  return out
}

const PACKS: Record<string, TaxJurisdictionPack> = {
  GB: {
    code: 'GB',
    label: 'United Kingdom',
    yearKind: 'uk-apr',
    matching: 'uk-section104',
    rate: 0.2,
    allowances: { ...CGT_ALLOWANCES },
    hasCgt: true,
    disclaimer:
      'UK CGT with §104 pooling from journal buys. Same-day / B&B heuristics when journal acquisitions exist. Not formal tax advice.',
  },
  US: {
    code: 'US',
    label: 'United States',
    yearKind: 'calendar',
    matching: 'fifo-simple',
    rate: 0.15,
    allowances: calendarAllowances(0),
    hasCgt: true,
    disclaimer:
      'Simplified US long-term capital gains at a flat 15% reference rate (no wash-sale / Form 8949). Calendar tax year. Not formal tax advice.',
  },
  IE: {
    code: 'IE',
    label: 'Ireland',
    yearKind: 'calendar',
    matching: 'fifo-simple',
    rate: 0.33,
    allowances: calendarAllowances(1270),
    hasCgt: true,
    disclaimer:
      'Simplified Irish CGT at 33% with a flat annual exemption reference. Calendar tax year. Not formal tax advice.',
  },
  AU: {
    code: 'AU',
    label: 'Australia',
    yearKind: 'calendar',
    matching: 'fifo-simple',
    rate: 0.225,
    allowances: calendarAllowances(0),
    hasCgt: true,
    disclaimer:
      'Simplified Australian CGT at a flat reference rate (no 50% discount modelling). Calendar year. Not formal tax advice.',
  },
  CA: {
    code: 'CA',
    label: 'Canada',
    yearKind: 'calendar',
    matching: 'fifo-simple',
    rate: 0.25,
    allowances: calendarAllowances(0),
    hasCgt: true,
    disclaimer:
      'Simplified Canadian capital gains at a flat reference rate (inclusion rate not modelled). Calendar year. Not formal tax advice.',
  },
  SG: {
    code: 'SG',
    label: 'Singapore',
    yearKind: 'calendar',
    matching: 'none',
    rate: 0,
    allowances: calendarAllowances(0),
    hasCgt: false,
    disclaimer:
      'Singapore generally does not levy personal capital gains tax on investment disposals. MyDSP keeps a disposal journal for records only.',
  },
  TH: {
    code: 'TH',
    label: 'Thailand',
    yearKind: 'calendar',
    matching: 'none',
    rate: 0,
    allowances: calendarAllowances(0),
    hasCgt: false,
    disclaimer:
      'Thailand personal capital gains treatment depends on residency and asset class. MyDSP does not compute Thai CGT — journal only.',
  },
  XX: {
    code: 'XX',
    label: 'Other / unspecified',
    yearKind: 'calendar',
    matching: 'fifo-simple',
    rate: 0,
    allowances: calendarAllowances(0),
    hasCgt: true,
    disclaimer:
      'Generic calendar-year gain/loss tracker with no jurisdiction rate applied. Set a specific residency in Settings when available.',
  },
}

export function getTaxPack(code: string | undefined | null): TaxJurisdictionPack {
  const key = (code || 'GB').trim().toUpperCase()
  return PACKS[key] ?? PACKS.XX
}

export function listTaxPackCodes(): string[] {
  return Object.keys(PACKS)
}

/** Current year key for the pack (UK Apr–Apr or calendar YYYY). */
export function getCurrentPackYear(pack: TaxJurisdictionPack, now = new Date()): string {
  if (pack.yearKind === 'uk-apr') return getCurrentTaxYear(now)
  return String(now.getFullYear())
}

export function listPackYears(pack: TaxJurisdictionPack): string[] {
  const keys = Object.keys(pack.allowances)
  if (pack.yearKind === 'uk-apr') {
    return keys.sort((a, b) => b.localeCompare(a))
  }
  return keys.sort((a, b) => Number(b) - Number(a))
}

export function getPackYearRange(
  pack: TaxJurisdictionPack,
  yearKey: string,
): { start: Date; end: Date } {
  if (pack.yearKind === 'uk-apr') {
    const startYear = parseInt(yearKey.split('/')[0], 10)
    return {
      start: new Date(startYear, 3, 6),
      end: new Date(startYear + 1, 3, 5, 23, 59, 59),
    }
  }
  const y = parseInt(yearKey, 10)
  return {
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31, 23, 59, 59),
  }
}

/** Simple FIFO / chronological matching: pair each disposal with its own cost field. */
export function matchDisposalsSimple(
  disposals: Disposal[],
  pack: TaxJurisdictionPack,
  yearKey: string,
): { gain: number; disposal: Disposal; matchedRule: string; allowableCost: number; note: string }[] {
  const { start, end } = getPackYearRange(pack, yearKey)
  return disposals
    .filter((d) => {
      const date = new Date(d.date)
      return date >= start && date <= end
    })
    .map((d) => {
      const gain = d.proceeds - d.cost
      return {
        disposal: d,
        gain,
        allowableCost: d.cost,
        matchedRule: pack.matching === 'none' ? 'record' : 'fifo',
        note:
          pack.matching === 'none'
            ? 'Record only — no CGT computed for this residency'
            : 'Simplified cost basis from disposal entry (FIFO / manual cost)',
      }
    })
}

export function calcTaxSummaryForPack(
  matched: { gain: number; disposal: Disposal }[],
  yearKey: string,
  pack: TaxJurisdictionPack,
): TaxSummary {
  if (pack.code === 'GB' && pack.matching === 'uk-section104') {
    return calcTaxSummaryFromMatched(matched, yearKey)
  }
  if (!pack.hasCgt) {
    return {
      allowance: 0,
      totalGains: 0,
      totalLosses: 0,
      netGain: 0,
      taxableGain: 0,
      cgtDue: 0,
      disposals: matched.map((m) => m.disposal),
    }
  }
  const allowance = pack.allowances[yearKey] ?? 0
  let totalGains = 0
  let totalLosses = 0
  for (const m of matched) {
    if (m.gain >= 0) totalGains += m.gain
    else totalLosses += Math.abs(m.gain)
  }
  const netGain = totalGains - totalLosses
  const taxableGain = Math.max(0, netGain - allowance)
  const cgtDue = taxableGain * pack.rate
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
