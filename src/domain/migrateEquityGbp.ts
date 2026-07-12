/** Keep US equity livePrice in GBP storage units. */

import type { EquityHolding, PortfolioData } from './types'
import { equityNeedsUsdToGbp } from './equityCurrency'
import { readHoldingHistory } from './holdingHistory'
import { loadStaticPriceSeries } from './staticPrices'
import { gbpUsdRate, type FxRates, usdToGbp } from '../services/fx'

export const EQUITY_GBP_VERSION = 2

/**
 * True when a US listing’s livePrice still looks like a raw USD quote
 * vs the bundled GBP series (≈ GBPUSD ratio).
 */
export function livePriceLooksLikeUsd(
  livePrice: number,
  refGbp: number | undefined,
  rates: FxRates,
): boolean {
  if (!(livePrice > 0)) return false
  if (!(refGbp && refGbp > 0)) return false
  const ratio = livePrice / refGbp
  const fx = gbpUsdRate(rates)
  // USD mislabeled as GBP ≈ multiply by GBPUSD (~1.15–1.45)
  if (ratio > 1.12 && ratio < 1.5) return true
  // Or live is within 8% of refGbp * fx (explicit USD level)
  const asUsd = refGbp * fx
  if (Math.abs(livePrice - asUsd) / asUsd < 0.08) return true
  return false
}

export function equityUnitPriceGbp(e: EquityHolding): number {
  return e.livePrice > 0 ? e.livePrice : e.avgCost
}

/**
 * Convert US equity livePrices that are still USD into GBP.
 * Idempotent via extras.equityGbpVersion === EQUITY_GBP_VERSION when prices look clean.
 */
export async function repairEquityLivePricesToGbp(
  data: PortfolioData,
  rates: FxRates,
): Promise<{ data: PortfolioData; repaired: boolean; symbols: string[] }> {
  const version = Number(data.extras?.equityGbpVersion ?? 0)
  const symbols: string[] = []

  const nextEquities: EquityHolding[] = []
  for (const e of data.equities) {
    if (!equityNeedsUsdToGbp(e.symbol) || !(e.livePrice > 0)) {
      nextEquities.push(e)
      continue
    }

    let refGbp: number | undefined
    try {
      const series = await loadStaticPriceSeries('equity', e.symbol)
      refGbp = series[series.length - 1]?.price
    } catch {
      refGbp = undefined
    }

    const flaggedClean = version >= EQUITY_GBP_VERSION
    const looksUsd = livePriceLooksLikeUsd(e.livePrice, refGbp, rates)
    const neverNormalized = version < 1 && data.extras?.equityPricesAreGbp !== true

    if (looksUsd || neverNormalized) {
      symbols.push(e.symbol)
      nextEquities.push({ ...e, livePrice: usdToGbp(e.livePrice, rates) })
      continue
    }

    // Wrongly flagged as GBP while still USD and no static ref — convert once if version < 2
    if (!flaggedClean && data.extras?.equityPricesAreGbp === true && !refGbp) {
      // Don't double-convert without evidence
      nextEquities.push(e)
      continue
    }

    nextEquities.push(e)
  }

  const hist = readHoldingHistory(data)
  const nextHist = { ...hist }
  let histChanged = false
  for (const key of Object.keys(nextHist)) {
    if (!key.startsWith('equity:')) continue
    const sym = key.slice('equity:'.length)
    if (!equityNeedsUsdToGbp(sym)) continue
    if (symbols.includes(sym) || version < EQUITY_GBP_VERSION) {
      delete nextHist[key]
      histChanged = true
    }
  }

  const repaired = symbols.length > 0 || histChanged || version < EQUITY_GBP_VERSION
  if (!repaired) return { data, repaired: false, symbols: [] }

  return {
    data: {
      ...data,
      equities: nextEquities,
      extras: {
        ...data.extras,
        holdingHistory: nextHist,
        equityPricesAreGbp: true,
        equityGbpVersion: EQUITY_GBP_VERSION,
      },
    },
    repaired: symbols.length > 0 || histChanged,
    symbols,
  }
}

/** Sync migration for tests / first paint before async static load. */
export function migrateEquityLivePricesToGbp(
  data: PortfolioData,
  rates: FxRates,
): { data: PortfolioData; migrated: boolean } {
  const version = Number(data.extras?.equityGbpVersion ?? 0)
  if (version >= EQUITY_GBP_VERSION && data.extras?.equityPricesAreGbp === true) {
    return { data, migrated: false }
  }

  // Without static refs, only convert when never marked GBP (avoid double-convert)
  if (data.extras?.equityPricesAreGbp === true && version >= 1) {
    return {
      data: {
        ...data,
        extras: { ...data.extras, equityGbpVersion: EQUITY_GBP_VERSION },
      },
      migrated: version < EQUITY_GBP_VERSION,
    }
  }

  const equities = data.equities.map((e) => {
    if (!equityNeedsUsdToGbp(e.symbol) || !(e.livePrice > 0)) return e
    return { ...e, livePrice: usdToGbp(e.livePrice, rates) }
  })

  const hist = readHoldingHistory(data)
  const nextHist = { ...hist }
  for (const key of Object.keys(nextHist)) {
    if (!key.startsWith('equity:')) continue
    const sym = key.slice('equity:'.length)
    if (!equityNeedsUsdToGbp(sym)) continue
    delete nextHist[key]
  }

  return {
    data: {
      ...data,
      equities,
      extras: {
        ...data.extras,
        holdingHistory: nextHist,
        equityPricesAreGbp: true,
        equityGbpVersion: EQUITY_GBP_VERSION,
      },
    },
    migrated: true,
  }
}
