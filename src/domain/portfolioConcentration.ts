import type { PortfolioData } from './types'
import { equityUnitPriceGbp } from './migrateEquityGbp'

const KEY = 'mydsp_portfolio_concentration_pct'
const META_KEY = 'mydsp_portfolio_concentration_pct_meta_v1'
export const DEFAULT_PORTFOLIO_CONCENTRATION_PCT = 25

export type PortfolioConcentrationBackup = {
  pct: number
  updatedAt: string
}

export type PortfolioConcentrationHit = {
  kind: 'crypto' | 'equity'
  id: number
  symbol: string
  name: string
  value: number
  weightPct: number
}

function clampConcentrationPct(pct: number): number {
  return Number.isFinite(pct) && pct > 0
    ? Math.min(100, Math.max(1, pct))
    : DEFAULT_PORTFOLIO_CONCENTRATION_PCT
}

export function loadPortfolioConcentrationThresholdPct(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null || raw === '') return DEFAULT_PORTFOLIO_CONCENTRATION_PCT
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_PORTFOLIO_CONCENTRATION_PCT
    return Math.min(100, Math.max(1, n))
  } catch {
    return DEFAULT_PORTFOLIO_CONCENTRATION_PCT
  }
}

export function savePortfolioConcentrationThresholdPct(
  pct: number,
  opts?: { markDirty?: boolean },
): void {
  const n = clampConcentrationPct(pct)
  const next: PortfolioConcentrationBackup = {
    pct: n,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(KEY, String(n))
    localStorage.setItem(META_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('mydsp-portfolio-concentration'))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportPortfolioConcentrationForBackup(): PortfolioConcentrationBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as PortfolioConcentrationBackup
      if (typeof parsed.pct === 'number' && Number.isFinite(parsed.pct)) {
        return {
          pct: clampConcentrationPct(parsed.pct),
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    return {
      pct: loadPortfolioConcentrationThresholdPct(),
      updatedAt: new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function importPortfolioConcentrationFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as PortfolioConcentrationBackup
  if (typeof remote.pct !== 'number' || !Number.isFinite(remote.pct)) return
  const local = exportPortfolioConcentrationForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const n = clampConcentrationPct(remote.pct)
  try {
    localStorage.setItem(KEY, String(n))
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        pct: n,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
    window.dispatchEvent(new CustomEvent('mydsp-portfolio-concentration'))
  } catch {
    /* ignore */
  }
}

export function includedPortfolioHoldingValue(data: PortfolioData): number {
  let total = 0
  for (const c of data.crypto) {
    if (c.includeInPortfolio === false) continue
    total += c.qty * c.price
  }
  for (const e of data.equities) {
    if (e.includeInPortfolio === false) continue
    total += e.shares * equityUnitPriceGbp(e)
  }
  return total
}

export function portfolioConcentrationHits(
  data: PortfolioData,
  thresholdPct: number = loadPortfolioConcentrationThresholdPct(),
): PortfolioConcentrationHit[] {
  const total = includedPortfolioHoldingValue(data)
  if (!(total > 0)) return []

  const hits: PortfolioConcentrationHit[] = []
  for (const c of data.crypto) {
    if (c.includeInPortfolio === false) continue
    const value = c.qty * c.price
    const weightPct = (value / total) * 100
    if (value > 0 && weightPct >= thresholdPct) {
      hits.push({ kind: 'crypto', id: c.id, symbol: c.symbol, name: c.name, value, weightPct })
    }
  }
  for (const e of data.equities) {
    if (e.includeInPortfolio === false) continue
    const value = e.shares * equityUnitPriceGbp(e)
    const weightPct = (value / total) * 100
    if (value > 0 && weightPct >= thresholdPct) {
      hits.push({ kind: 'equity', id: e.id, symbol: e.symbol, name: e.name, value, weightPct })
    }
  }
  return hits.sort((a, b) => b.weightPct - a.weightPct)
}
