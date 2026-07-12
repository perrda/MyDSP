/** Equity quote currency — US listings are USD; convert to GBP for storage. */

/** Symbols whose Yahoo/Finnhub quotes are already GBP (or GBp treated as GBP). */
const GBP_EQUITY_SUFFIXES = ['.L', '.LON', '.IL']

/**
 * Native quote currency for an equity ticker.
 * US listings (TSLA, MSTR, …) → USD. London (.L) → GBP.
 */
export function equityNativeCurrency(symbol: string): 'USD' | 'GBP' {
  const s = symbol.trim().toUpperCase()
  if (GBP_EQUITY_SUFFIXES.some((suf) => s.endsWith(suf))) return 'GBP'
  return 'USD'
}

export function equityNeedsUsdToGbp(symbol: string): boolean {
  return equityNativeCurrency(symbol) === 'USD'
}
