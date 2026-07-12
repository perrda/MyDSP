/** FX rates — portfolio stored in GBP; display converts out. */

export type FxRates = Record<string, number>

/** Approximate fallbacks when live FX / BTC is unavailable. BTC = GBP→BTC (1 / £ per BTC). */
export const DEFAULT_FX_RATES: FxRates = {
  GBP: 1,
  BTC: 1 / 85_000,
  USD: 1.27,
  EUR: 1.17,
  THB: 46,
  AUD: 1.95,
  CAD: 1.73,
  JPY: 190,
  CHF: 1.12,
  SGD: 1.71,
  HKD: 9.9,
}

export const DISPLAY_CURRENCIES = [
  { code: 'GBP', label: 'GBP £' },
  { code: 'BTC', label: 'BTC ₿' },
  { code: 'USD', label: 'USD $' },
  { code: 'THB', label: 'THB ฿' },
] as const

const CACHE_KEY = 'mydsp_fx_rates'

export function loadCachedFxRates(): FxRates {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { ...DEFAULT_FX_RATES }
    const parsed = JSON.parse(raw) as FxRates
    return { ...DEFAULT_FX_RATES, ...parsed, GBP: 1 }
  } catch {
    return { ...DEFAULT_FX_RATES }
  }
}

export function saveCachedFxRates(rates: FxRates): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...rates, updatedAt: Date.now() }))
  } catch {
    /* ignore */
  }
}

/** Convert GBP amount to display currency. */
export function convertFromGbp(amountGbp: number, currency: string, rates: FxRates): number {
  if (!Number.isFinite(amountGbp)) return 0
  if (!currency || currency === 'GBP') return amountGbp
  const rate = rates[currency] ?? DEFAULT_FX_RATES[currency] ?? 1
  return amountGbp * rate
}

async function fetchBtcPerGbp(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp',
    )
    if (!res.ok) return null
    const json = (await res.json()) as { bitcoin?: { gbp?: number } }
    const gbp = json.bitcoin?.gbp
    if (typeof gbp === 'number' && gbp > 0) return 1 / gbp
  } catch {
    /* ignore */
  }
  return null
}

export async function fetchFxRates(): Promise<FxRates> {
  const rates: FxRates = { GBP: 1 }

  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/GBP')
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number> }
      for (const c of DISPLAY_CURRENCIES) {
        if (c.code === 'GBP' || c.code === 'BTC') continue
        const r = json.rates?.[c.code]
        if (typeof r === 'number' && r > 0) rates[c.code] = r
      }
    }
  } catch {
    /* keep defaults below */
  }

  const btc = await fetchBtcPerGbp()
  if (btc != null) rates.BTC = btc

  const merged = { ...DEFAULT_FX_RATES, ...rates, GBP: 1 }
  saveCachedFxRates(merged)
  return merged
}
