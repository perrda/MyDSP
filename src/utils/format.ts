/** Currency formatting — amounts are GBP internally; display uses FX. */

import { convertFromGbp, type FxRates } from '../services/fx'

let displayCurrency = 'GBP'
let displayRates: FxRates = { GBP: 1 }

export function setDisplayCurrency(currency: string, rates: FxRates): void {
  displayCurrency = currency || 'GBP'
  displayRates = { GBP: 1, ...rates }
}

export function getDisplayCurrency(): string {
  return displayCurrency
}

function formatBtc(converted: number, opts?: { signed?: boolean }): string {
  const abs = Math.abs(converted)
  const digits = abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8
  const body = `₿${abs.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
  if (opts?.signed) {
    if (converted > 0) return `+${body}`
    if (converted < 0) return `−${body}`
  }
  if (converted < 0) return `−${body}`
  return body
}

function formatMoney(
  n: number,
  currency: string,
  opts?: { signed?: boolean; compact?: boolean; digits?: number },
): string {
  const converted = convertFromGbp(n, currency, displayRates)
  if (currency === 'BTC') return formatBtc(converted, opts)

  const abs = Math.abs(converted)
  const digits = opts?.digits
  const code = currency.length === 3 ? currency : 'GBP'
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: code,
    // Never render "US$" — always "USD" for US dollars
    currencyDisplay: code === 'USD' ? 'code' : 'symbol',
    notation: opts?.compact ? 'compact' : 'standard',
    maximumFractionDigits: digits ?? (opts?.compact ? 2 : currency === 'JPY' ? 0 : 2),
    minimumFractionDigits: digits ?? (opts?.compact ? 0 : currency === 'JPY' ? 0 : 2),
  }).format(abs)

  if (opts?.signed) {
    if (n > 0) return `+${formatted}`
    if (n < 0) return `−${formatted}`
  }
  if (n < 0) return `−${formatted}`
  return formatted
}

/** Format GBP amount in the active display currency. */
export function formatGBP(n: number, opts?: { signed?: boolean; compact?: boolean }): string {
  return formatMoney(n, displayCurrency, opts)
}

export function formatGBPPrecise(n: number): string {
  if (displayCurrency === 'BTC') return formatMoney(n, 'BTC')
  return formatMoney(n, displayCurrency, { digits: 2 })
}

/**
 * Format a GBP market print in the active display currency.
 * Uses more fraction digits for sub-unit prices (ADA, USDC, NIGHT, …).
 */
export function formatGBPMarket(n: number, opts?: { signed?: boolean }): string {
  if (!Number.isFinite(n)) return '—'
  if (displayCurrency === 'BTC') return formatMoney(n, 'BTC', opts)
  const converted = Math.abs(convertFromGbp(n, displayCurrency, displayRates))
  const digits = converted >= 1 ? 2 : converted >= 0.01 ? 4 : 6
  return formatMoney(n, displayCurrency, { ...opts, digits })
}

/**
 * Format an amount already denominated in `currency` (no GBP conversion).
 * Use for job salaries and other foreign-currency fields stored as-is.
 */
export function formatNativeCurrency(
  n: number,
  currency: string,
  opts?: { signed?: boolean; digits?: number },
): string {
  if (!Number.isFinite(n)) return '—'
  const code = (currency || 'GBP').toUpperCase()
  if (code === 'BTC') return formatBtc(n, opts)
  const abs = Math.abs(n)
  const digits = opts?.digits ?? (code === 'JPY' || code === 'KRW' ? 0 : 2)
  const currencyCode = code.length === 3 ? code : 'GBP'
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: currencyCode === 'USD' ? 'code' : 'symbol',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits === 0 ? 0 : Math.min(2, digits),
  }).format(abs)
  if (opts?.signed) {
    if (n > 0) return `+${formatted}`
    if (n < 0) return `−${formatted}`
  }
  if (n < 0) return `−${formatted}`
  return formatted
}

export function formatPct(n: number, digits = 1): string {
  const sign = n > 0 ? '+' : n < 0 ? '' : ''
  return `${sign}${n.toFixed(digits)}%`
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // Local computer timezone — e.g. "14 Jul 2026"
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // Local computer timezone — e.g. "14 Jul 2026, 11:20:08" (Bangkok if device is set to ICT)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

export function formatQty(n: number): string {
  if (Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(n)
  }
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 }).format(n)
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.min(100, Math.round((part / whole) * 100))
}

/** Privacy blur helper class when privacy mode on. */
export function privacyClass(privacy: boolean): string {
  return privacy ? 'blur-sm select-none' : ''
}
