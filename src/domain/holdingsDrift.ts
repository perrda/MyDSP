/** Alert when Markets live quote differs from holding price by more than X%. */

import type { CryptoHolding, EquityHolding } from './types'
import { lastSyncedHoldingPrices } from './lastSyncedHoldings'
import { equityUnitPriceGbp } from './migrateEquityGbp'

const KEY = 'mydsp_holdings_drift_pct'
const META_KEY = 'mydsp_holdings_drift_pct_meta_v1'
export const DEFAULT_HOLDINGS_DRIFT_PCT = 5

export type HoldingsDriftBackup = {
  pct: number
  updatedAt: string
}

function clampDriftPct(pct: number): number {
  return Number.isFinite(pct) && pct > 0
    ? Math.min(50, Math.max(0.5, pct))
    : DEFAULT_HOLDINGS_DRIFT_PCT
}

export function loadHoldingsDriftThresholdPct(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null || raw === '') return DEFAULT_HOLDINGS_DRIFT_PCT
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_HOLDINGS_DRIFT_PCT
    return Math.min(50, Math.max(0.5, n))
  } catch {
    return DEFAULT_HOLDINGS_DRIFT_PCT
  }
}

export function saveHoldingsDriftThresholdPct(
  pct: number,
  opts?: { markDirty?: boolean },
): void {
  const n = clampDriftPct(pct)
  const next: HoldingsDriftBackup = { pct: n, updatedAt: new Date().toISOString() }
  try {
    localStorage.setItem(KEY, String(n))
    localStorage.setItem(META_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('mydsp-holdings-drift'))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportHoldingsDriftForBackup(): HoldingsDriftBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as HoldingsDriftBackup
      if (typeof parsed.pct === 'number' && Number.isFinite(parsed.pct)) {
        return {
          pct: clampDriftPct(parsed.pct),
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    return { pct: loadHoldingsDriftThresholdPct(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importHoldingsDriftFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as HoldingsDriftBackup
  if (typeof remote.pct !== 'number' || !Number.isFinite(remote.pct)) return
  const local = exportHoldingsDriftForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const n = clampDriftPct(remote.pct)
  try {
    localStorage.setItem(KEY, String(n))
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        pct: n,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
    window.dispatchEvent(new CustomEvent('mydsp-holdings-drift'))
  } catch {
    /* ignore */
  }
}

export type HoldingDriftHit = {
  symbol: string
  holdingPrice: number
  marketPrice: number
  driftPct: number
}

function driftPct(holding: number, market: number): number | null {
  if (!(holding > 0) || !(market > 0)) return null
  return ((market - holding) / holding) * 100
}

function normSym(s: string): string {
  return s.trim().toUpperCase().replace(/^\^/, '')
}

export function equityDriftHits(
  equities: EquityHolding[],
  thresholdPct: number = loadHoldingsDriftThresholdPct(),
): HoldingDriftHit[] {
  const { equities: marketMap } = lastSyncedHoldingPrices()
  const out: HoldingDriftHit[] = []
  for (const e of equities) {
    const market = marketMap.get(normSym(e.symbol))
    if (!(market && market > 0)) continue
    const holding = equityUnitPriceGbp(e)
    const pct = driftPct(holding, market)
    if (pct == null) continue
    if (Math.abs(pct) < thresholdPct) continue
    out.push({
      symbol: e.symbol,
      holdingPrice: holding,
      marketPrice: market,
      driftPct: pct,
    })
  }
  return out
}

export function cryptoDriftHits(
  crypto: CryptoHolding[],
  thresholdPct: number = loadHoldingsDriftThresholdPct(),
): HoldingDriftHit[] {
  const { crypto: marketMap } = lastSyncedHoldingPrices()
  const out: HoldingDriftHit[] = []
  for (const c of crypto) {
    const market = marketMap.get(normSym(c.symbol))
    if (!(market && market > 0)) continue
    const holding = c.price
    const pct = driftPct(holding, market)
    if (pct == null) continue
    if (Math.abs(pct) < thresholdPct) continue
    out.push({
      symbol: c.symbol,
      holdingPrice: holding,
      marketPrice: market,
      driftPct: pct,
    })
  }
  return out
}

export function isSymbolDrifting(hits: HoldingDriftHit[], symbol: string): boolean {
  const key = normSym(symbol)
  return hits.some((h) => normSym(h.symbol) === key)
}
