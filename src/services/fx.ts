/** FX rates — portfolio stored in GBP; display converts out. */

export type FxRates = Record<string, number>

/** Approximate fallbacks when live FX / BTC is unavailable. BTC = GBP→BTC (1 / £ per BTC). */
export const DEFAULT_FX_RATES: FxRates = {
  GBP: 1,
  BTC: 1 / 85_000,
  /** GBP→USD: how many USD one pound buys. */
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
/** Refresh FX about once per day (and on every price refresh via ensureFxRates). */
export const FX_STALE_MS = 20 * 60 * 60 * 1000

export function loadCachedFxRates(): FxRates {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { ...DEFAULT_FX_RATES }
    const parsed = JSON.parse(raw) as FxRates & { updatedAt?: number }
    const { updatedAt: _u, ...rest } = parsed
    return { ...DEFAULT_FX_RATES, ...rest, GBP: 1 }
  } catch {
    return { ...DEFAULT_FX_RATES }
  }
}

export function fxCacheUpdatedAt(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { updatedAt?: number }
    return typeof parsed.updatedAt === 'number' ? parsed.updatedAt : null
  } catch {
    return null
  }
}

export function saveCachedFxRates(rates: FxRates): void {
  try {
    const { updatedAt: _drop, ...clean } = rates as FxRates & { updatedAt?: number }
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...clean, GBP: 1, updatedAt: Date.now() }),
    )
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

/**
 * Convert a USD market quote into GBP using GBP→USD rate.
 * rates.USD = dollars per pound (e.g. 1.27), so GBP = USD / rates.USD.
 */
export function usdToGbp(amountUsd: number, rates: FxRates = loadCachedFxRates()): number {
  if (!Number.isFinite(amountUsd) || amountUsd === 0) return 0
  const gbpUsd = rates.USD > 0 ? rates.USD : DEFAULT_FX_RATES.USD
  return amountUsd / gbpUsd
}

/** Dollars per one pound (GBPUSD). */
export function gbpUsdRate(rates: FxRates = loadCachedFxRates()): number {
  return rates.USD > 0 ? rates.USD : DEFAULT_FX_RATES.USD
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
      const usd = json.rates?.USD
      if (typeof usd === 'number' && usd > 0) rates.USD = usd
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

/** Return cached rates if fresh; otherwise fetch (falls back to cache on failure). */
export async function ensureFxRates(maxAgeMs = FX_STALE_MS): Promise<FxRates> {
  const cached = loadCachedFxRates()
  const updatedAt = fxCacheUpdatedAt()
  const age = updatedAt != null ? Date.now() - updatedAt : Number.POSITIVE_INFINITY
  if (age < maxAgeMs && cached.USD > 0) return cached
  try {
    return await fetchFxRates()
  } catch {
    return cached
  }
}
