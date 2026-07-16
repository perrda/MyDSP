/** Commodity futures / spot symbols for Markets (Yahoo chart symbols). */

export interface CommoditySpec {
  /** Canonical Yahoo symbol e.g. GC=F */
  symbol: string
  name: string
  /** Physical unit label for UI hints (oz, lb) */
  unitLabel: string
  /** Native quote currency from Yahoo (usually USD) */
  currency: 'USD' | 'GBP'
}

/** Seeded My Commodities watchlist — COMEX continuous futures. */
export const DEFAULT_COMMODITIES: CommoditySpec[] = [
  { symbol: 'GC=F', name: 'Gold', unitLabel: 'troy oz', currency: 'USD' },
  { symbol: 'SI=F', name: 'Silver', unitLabel: 'troy oz', currency: 'USD' },
  { symbol: 'HG=F', name: 'Copper', unitLabel: 'lb', currency: 'USD' },
]

/** Aliases → canonical Yahoo commodity symbol. */
export const COMMODITY_ALIASES: Record<string, string> = {
  GOLD: 'GC=F',
  XAU: 'GC=F',
  XAUUSD: 'XAUUSD=X',
  'XAUUSD=X': 'XAUUSD=X',
  'GC=F': 'GC=F',
  SILVER: 'SI=F',
  XAG: 'SI=F',
  XAGUSD: 'XAGUSD=X',
  'XAGUSD=X': 'XAGUSD=X',
  'SI=F': 'SI=F',
  COPPER: 'HG=F',
  'HG=F': 'HG=F',
  PLATINUM: 'PL=F',
  'PL=F': 'PL=F',
  PALLADIUM: 'PA=F',
  'PA=F': 'PA=F',
  OIL: 'CL=F',
  CRUDE: 'CL=F',
  WTI: 'CL=F',
  'CL=F': 'CL=F',
  BRENT: 'BZ=F',
  'BZ=F': 'BZ=F',
  NATGAS: 'NG=F',
  'NG=F': 'NG=F',
}

const SPEC_BY_SYMBOL: Record<string, CommoditySpec> = {
  'GC=F': DEFAULT_COMMODITIES[0]!,
  'SI=F': DEFAULT_COMMODITIES[1]!,
  'HG=F': DEFAULT_COMMODITIES[2]!,
  'XAUUSD=X': { symbol: 'XAUUSD=X', name: 'Gold spot', unitLabel: 'troy oz', currency: 'USD' },
  'XAGUSD=X': { symbol: 'XAGUSD=X', name: 'Silver spot', unitLabel: 'troy oz', currency: 'USD' },
  'PL=F': { symbol: 'PL=F', name: 'Platinum', unitLabel: 'troy oz', currency: 'USD' },
  'PA=F': { symbol: 'PA=F', name: 'Palladium', unitLabel: 'troy oz', currency: 'USD' },
  'CL=F': { symbol: 'CL=F', name: 'Crude oil (WTI)', unitLabel: 'bbl', currency: 'USD' },
  'BZ=F': { symbol: 'BZ=F', name: 'Brent crude', unitLabel: 'bbl', currency: 'USD' },
  'NG=F': { symbol: 'NG=F', name: 'Natural gas', unitLabel: 'MMBtu', currency: 'USD' },
}

/** Normalize user input to a Yahoo commodity chart symbol. */
export function normalizeCommoditySymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase().replace(/\s+/g, '')
  if (!raw) return ''
  if (COMMODITY_ALIASES[raw]) return COMMODITY_ALIASES[raw]
  // GOLD/USD style → try base
  const slash = raw.replace(/-/g, '/').split('/')
  if (slash.length === 2 && COMMODITY_ALIASES[slash[0]!]) {
    return COMMODITY_ALIASES[slash[0]!]!
  }
  return raw
}

export function commoditySpec(symbol: string): CommoditySpec | undefined {
  const sym = normalizeCommoditySymbol(symbol)
  return SPEC_BY_SYMBOL[sym]
}

export function commodityDisplayName(symbol: string): string {
  return commoditySpec(symbol)?.name || normalizeCommoditySymbol(symbol)
}

export function isCommodityYahooSymbol(symbol: string): boolean {
  const sym = normalizeCommoditySymbol(symbol)
  return Boolean(SPEC_BY_SYMBOL[sym]) || /=[FX]$/.test(sym) || /^(GC|SI|HG|PL|PA|CL|BZ|NG)=F$/.test(sym)
}
