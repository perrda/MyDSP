/** Build Markets price-alert notifications from last-good quote cache. */

import { loadMarketQuotesCache } from '../storage/marketsStore'
import { listMarketTickers } from '../storage/marketsStore'
import type { Notification } from '../utils/notifications'

const THRESHOLDS_KEY = 'mydsp_price_alert_thresholds_v1'

export interface PriceAlertThreshold {
  /** Market ticker id or symbol */
  key: string
  /** Alert when abs(changePct) >= this */
  changePct: number
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
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_THRESHOLDS
    return parsed.filter(
      (t): t is PriceAlertThreshold =>
        !!t &&
        typeof t === 'object' &&
        typeof (t as PriceAlertThreshold).key === 'string' &&
        typeof (t as PriceAlertThreshold).changePct === 'number',
    )
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

export function savePriceAlertThresholds(thresholds: PriceAlertThreshold[]): void {
  const cleaned = thresholds.filter(
    (t) => t.key.trim() && Number.isFinite(t.changePct) && t.changePct > 0,
  )
  try {
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(cleaned.length ? cleaned : DEFAULT_THRESHOLDS))
    window.dispatchEvent(new CustomEvent('mydsp-price-alerts'))
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
    if (Math.abs(q.changePct) < th.changePct) continue
    const dir = q.changePct >= 0 ? 'up' : 'down'
    const bigMove = Math.abs(q.changePct) >= th.changePct * 2
    out.push({
      id: `price-${ticker.id}-${Math.round(q.changePct * 10)}`,
      type: bigMove ? 'warning' : 'info',
      // 2× threshold → critical so desktop banners fire with default Settings threshold
      priority: bigMove ? 'critical' : 'high',
      title: `${ticker.symbol} ${dir} ${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
      message: `Last print ${q.last.toLocaleString(undefined, { maximumFractionDigits: q.decimals })} ${q.unit} · threshold ±${th.changePct}%`,
      actionUrl: `/markets?symbol=${encodeURIComponent(ticker.symbol)}`,
      actionLabel: 'Markets',
      dismissible: true,
      category: 'price-alerts',
      metadata: { triggered: true, changePct: q.changePct, threshold: th.changePct },
    })
  }
  return out
}
