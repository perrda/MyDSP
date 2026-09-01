/** Equity quote currency — US listings are USD; convert to GBP for storage. */

/** Symbols whose Yahoo/Finnhub quotes are already GBP (or GBp treated as GBP). */
const GBP_EQUITY_SUFFIXES = ['.L', '.LON', '.IL']

/**
 * London-listed UCITS / LSE tickers often stored without a `.L` suffix
 * (seed VWRL / VUSA). These quote and settle in GBP, not USD.
 */
const GBP_EQUITY_SYMBOLS = new Set([
  'VWRL',
  'VUSA',
  'VUAG',
  'VHYL',
  'VWRP',
  'VEVE',
  'VFEM',
  'VMID',
  'VUKG',
  'ISF',
  'SWDA',
  'CSPX',
])

/**
 * Native quote currency for an equity ticker.
 * US listings (TSLA, MSTR, …) → USD. London (.L) and known LSE UCITS → GBP.
 */
export function equityNativeCurrency(symbol: string): 'USD' | 'GBP' {
  const s = symbol.trim().toUpperCase()
  if (GBP_EQUITY_SUFFIXES.some((suf) => s.endsWith(suf))) return 'GBP'
  if (GBP_EQUITY_SYMBOLS.has(s)) return 'GBP'
  return 'USD'
}

export function equityNeedsUsdToGbp(symbol: string): boolean {
  return equityNativeCurrency(symbol) === 'USD'
}

/**
 * Yahoo / Finnhub venue symbol. Seed book stores LSE UCITS as VWRL / VUSA
 * without `.L` — Refresh must query VWRL.L / VUSA.L or the line stays £0.
 */
export function yahooVenueEquitySymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s) return s
  if (GBP_EQUITY_SUFFIXES.some((suf) => s.endsWith(suf))) return s
  if (GBP_EQUITY_SYMBOLS.has(s)) return `${s}.L`
  return s
}
