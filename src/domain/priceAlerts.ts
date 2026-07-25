/** Build Markets price-alert notifications from last-good quote cache. */

import { loadMarketQuotesCache } from '../storage/marketsStore'
import { listMarketTickers } from '../storage/marketsStore'
import type { Notification } from '../utils/notifications'

const THRESHOLDS_KEY = 'mydsp_price_alert_thresholds_v1'

export interface PriceAlertThreshold {
  /** Market ticker id or symbol */
  key: string
  /** Percent alerts fire when abs(changePct) >= this */
  changePct: number
  /** Alert mode: percentage move or absolute target price */
  mode?: 'percent' | 'target'
  /** Target alerts fire when the last print reaches or exceeds this value */
  targetPrice?: number
}

const DEFAULT_THRESHOLDS: PriceAlertThreshold[] = [
  { key: 'BTC', changePct: 3 },
  { key: '^FTSE', changePct: 1 },
  { key: '^GSPC', changePct: 1 },
  { key: 'GBP/USD', changePct: 0.5 },
]

export function loadPriceAlertThresholds(): PriceAlertThreshold[] {
  try {
    const raw = localStorage.getItem(THRESHOLDS_KEY)
    if (!raw) return DEFAULT_THRESHOLDS
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_THRESHOLDS
    const cleaned = parsed
      .map(normalizePriceAlertThreshold)
      .filter((t): t is PriceAlertThreshold => t != null)
    return cleaned
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

export function normalizePriceAlertThreshold(raw: unknown): PriceAlertThreshold | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as PriceAlertThreshold
  if (typeof r.key !== 'string' || !r.key.trim()) return null
  const mode = r.mode === 'target' ? 'target' : 'percent'
  const changePct = typeof r.changePct === 'number' ? r.changePct : Number(r.changePct)
  const targetPrice =
    typeof r.targetPrice === 'number' ? r.targetPrice : Number((r as { targetPrice?: unknown }).targetPrice)
  if (mode === 'target') {
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) return null
    return {
      key: r.key.trim(),
      changePct: Number.isFinite(changePct) && changePct > 0 ? changePct : 1,
      mode,
      targetPrice,
    }
  }
  if (!Number.isFinite(changePct) || changePct <= 0) return null
  return {
    key: r.key.trim(),
    changePct,
    mode,
  }
}

export function savePriceAlertThresholds(
  thresholds: PriceAlertThreshold[],
  opts?: { markDirty?: boolean },
): void {
  const cleaned = thresholds
    .map(normalizePriceAlertThreshold)
    .filter((t): t is PriceAlertThreshold => t != null)
  try {
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(cleaned))
    localStorage.setItem(`${THRESHOLDS_KEY}_at`, new Date().toISOString())
    window.dispatchEvent(new CustomEvent('mydsp-price-alerts'))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportPriceAlertThresholdsForBackup(): {
  thresholds: PriceAlertThreshold[]
  updatedAt: string
} {
  return {
    thresholds: loadPriceAlertThresholds(),
    updatedAt: new Date().toISOString(),
  }
}

export function importPriceAlertThresholdsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as { thresholds?: unknown; updatedAt?: string }
  if (!Array.isArray(parsed.thresholds)) return
  // Prefer remote when it has any thresholds (simple LWW via presence + updatedAt)
  const remoteAt = Date.parse(parsed.updatedAt || '') || 0
  let localAt = 0
  try {
    localAt = Date.parse(localStorage.getItem(`${THRESHOLDS_KEY}_at`) || '') || 0
  } catch {
    /* ignore */
  }
  if (localAt > remoteAt && localAt > 0) return
  savePriceAlertThresholds(parsed.thresholds as PriceAlertThreshold[], { markDirty: false })
  try {
    localStorage.setItem(`${THRESHOLDS_KEY}_at`, parsed.updatedAt || new Date().toISOString())
  } catch {
    /* ignore */
  }
}

export function resetPriceAlertThresholds(): PriceAlertThreshold[] {
  savePriceAlertThresholds(DEFAULT_THRESHOLDS)
  return DEFAULT_THRESHOLDS
}

export function buildPriceAlertNotifications(): Array<
  Omit<Notification, 'id' | 'timestamp' | 'read'> & { id: string }
> {
  const quotes = loadMarketQuotesCache()
  const tickers = listMarketTickers()
  const thresholds = loadPriceAlertThresholds()
  const out: Array<Omit<Notification, 'id' | 'timestamp' | 'read'> & { id: string }> = []

  for (const th of thresholds) {
    const ticker =
      tickers.find(
        (t) =>
          t.id === th.key ||
          t.symbol.toUpperCase() === th.key.toUpperCase() ||
          t.symbol.replace('^', '').toUpperCase() === th.key.replace('^', '').toUpperCase(),
      ) ?? null
    if (!ticker) continue
    const q = quotes.get(ticker.id)
    if (!q || !(q.last > 0)) continue
    const mode = th.mode === 'target' ? 'target' : 'percent'
    const thresholdMet =
      mode === 'target'
        ? th.targetPrice != null && q.last >= th.targetPrice
        : Math.abs(q.changePct) >= th.changePct
    if (!thresholdMet) continue
    const dir = q.changePct >= 0 ? 'up' : 'down'
    const bigMove =
      mode === 'target'
        ? th.targetPrice != null && q.last >= th.targetPrice * 1.02
        : Math.abs(q.changePct) >= th.changePct * 2
    const targetText =
      mode === 'target' && th.targetPrice != null
        ? `target ${th.targetPrice.toLocaleString(undefined, { maximumFractionDigits: q.decimals })}`
        : `threshold ±${th.changePct}%`
    out.push({
      id: `price-${ticker.id}-${mode}-${Math.round((mode === 'target' ? q.last : q.changePct) * 10)}`,
      type: bigMove ? 'warning' : 'info',
      // 2× threshold → critical so desktop banners fire with default Settings threshold
      priority: bigMove ? 'critical' : 'high',
      title:
        mode === 'target'
          ? `${ticker.symbol} reached target`
          : `${ticker.symbol} ${dir} ${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
      message: `Last print ${q.last.toLocaleString(undefined, { maximumFractionDigits: q.decimals })} ${q.unit} · ${targetText}`,
      actionUrl: `/markets?symbol=${encodeURIComponent(ticker.symbol)}`,
      actionLabel: 'Markets',
      dismissible: true,
      category: 'price-alerts',
      metadata: {
        triggered: true,
        changePct: q.changePct,
        threshold: th.changePct,
        mode,
        targetPrice: th.targetPrice,
      },
    })
  }
  return out
}
