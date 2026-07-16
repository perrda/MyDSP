/** Tax-year calendar progress + CGT allowance usage for TaxPage ring. */

import { getPackYearRange, type TaxJurisdictionPack } from './taxPacks'

export interface TaxYearProgress {
  yearKey: string
  daysElapsed: number
  daysTotal: number
  daysLeft: number
  /** 0–1 fraction of tax year elapsed. */
  yearPct: number
  /** Estimated CGT used vs allowance (0–1+); null when no allowance. */
  cgtUsedPct: number | null
  cgtUsed: number
  allowance: number
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Days left in the pack tax year + optional CGT allowance usage.
 * `netGain` is the estimated net gain for the year (from tax summary).
 */
export function taxYearProgress(
  pack: TaxJurisdictionPack,
  yearKey: string,
  netGain: number,
  now = new Date(),
): TaxYearProgress {
  const { start, end } = getPackYearRange(pack, yearKey)
  const startDay = startOfLocalDay(start)
  const endDay = startOfLocalDay(end)
  const today = startOfLocalDay(now)

  const msDay = 24 * 60 * 60 * 1000
  const daysTotal = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / msDay) + 1)

  let daysElapsed: number
  if (today < startDay) daysElapsed = 0
  else if (today > endDay) daysElapsed = daysTotal
  else daysElapsed = Math.round((today.getTime() - startDay.getTime()) / msDay) + 1

  const daysLeft = Math.max(0, daysTotal - daysElapsed)
  const yearPct = Math.min(1, Math.max(0, daysElapsed / daysTotal))

  const allowance = pack.hasCgt ? (pack.allowances[yearKey] ?? 0) : 0
  const cgtUsed = Math.min(Math.max(0, netGain), allowance > 0 ? allowance : Math.max(0, netGain))
  const cgtUsedPct = allowance > 0 ? Math.max(0, netGain) / allowance : null

  return {
    yearKey,
    daysElapsed,
    daysTotal,
    daysLeft,
    yearPct,
    cgtUsedPct,
    cgtUsed: allowance > 0 ? Math.min(Math.max(0, netGain), allowance) : cgtUsed,
    allowance,
  }
}
