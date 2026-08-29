import type { MarketQuote, MarketTicker } from './markets'

export type SectionTotals = {
  value: number
  changeAbs: number
  /** Null when no priced quote has a finite change — never a fake 0. */
  changePct: number | null
  matched: number
  avgPct: number | null
}

/** Seeded / last-good sources that coerce a missing session print to 0. */
function isPlaceholderChangeSource(source: string): boolean {
  const src = (source || '').toLowerCase()
  return (
    src === 'portfolio' ||
    src === 'fx-cache' ||
    src === 'cache' ||
    src === 'none' ||
    src === 'error' ||
    src === 'invalid' ||
    src.startsWith('stale:') ||
    src.startsWith('sync:')
  )
}

/** Live session % only. Missing / coalesced 0 never counts as a print. */
export function finiteChangePct(q: MarketQuote | undefined): number | null {
  if (!q || !(q.last > 0)) return null
  if (typeof q.changePct !== 'number' || !Number.isFinite(q.changePct)) return null
  if (
    isPlaceholderChangeSource(q.source) &&
    Math.abs(q.changePct) < 0.0001 &&
    Math.abs(q.changeAbs) < 0.0000001
  ) {
    return null
  }
  return q.changePct
}

/** Group % for a Markets section — live prints only. Missing quote → no 0.00%. */
export function sectionTotals(
  tickers: MarketTicker[],
  quotes: Map<string, MarketQuote>,
  holdingsValueBySymbol: Map<string, number>,
): SectionTotals {
  let value = 0
  let pricedValue = 0
  let prevValue = 0
  let matched = 0
  let avgPct = 0
  let pctCount = 0

  for (const t of tickers) {
    const q = quotes.get(t.id)
    const pct = finiteChangePct(q)
    if (pct != null) {
      pctCount++
      avgPct += pct
    }
    if (!q || !(q.last > 0)) continue
    if (t.kind === 'fx' || t.kind === 'cross' || t.kind === 'index') continue

    const held = holdingsValueBySymbol.get(t.symbol.toUpperCase())
    if (held != null && held > 0) {
      matched++
      value += held
      if (pct != null) {
        const qtyImplied = held / q.last
        pricedValue += held
        prevValue += held - q.changeAbs * qtyImplied
      }
    }
  }

  const avg = pctCount > 0 ? avgPct / pctCount : null
  const changePct = prevValue > 0 ? ((pricedValue - prevValue) / prevValue) * 100 : avg
  return {
    value,
    changeAbs: value - prevValue,
    changePct,
    matched,
    avgPct: avg,
  }
}

/** Header change copy — "—" / Unpriced, never 0.00% on a missing quote. */
export function sectionGroupChangeLabel(
  totals: SectionTotals,
  itemCount: number,
  isRateSection: boolean,
  formatPct: (n: number, digits?: number) => string,
  formatHoldingsChange?: (abs: number, pct: number) => string,
): string {
  const pct = isRateSection || !(totals.matched > 0) ? totals.avgPct : totals.changePct
  if (pct == null || !Number.isFinite(pct)) {
    return itemCount > 0 ? 'Unpriced' : '—'
  }
  if (!isRateSection && totals.matched > 0 && formatHoldingsChange) {
    return formatHoldingsChange(totals.changeAbs, pct)
  }
  return formatPct(pct, 2)
}
