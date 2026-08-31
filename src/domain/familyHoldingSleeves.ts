/** Named family books — gifted TSLA / MSTR / ADA sleeves. */

import type { CryptoHolding, EquityAccountType, EquityHolding, PortfolioData } from './types'

/** Persists on the book (syncs) so Reset stays empty and a backup carries the one-shot. */
export const FAMILY_SLEEVES_APPLIED_EXTRA = 'familySleevesApplied'
/** v3 re-applies once — Andrew stayed blank after the v2 leftover stamp. */
export const FAMILY_SLEEVES_APPLIED_VERSION = 'v3'

export function hasFamilySleevesApplied(data: PortfolioData): boolean {
  return data.extras?.[FAMILY_SLEEVES_APPLIED_EXTRA] === FAMILY_SLEEVES_APPLIED_VERSION
}

export function markFamilySleevesAppliedOnData(data: PortfolioData): PortfolioData {
  if (hasFamilySleevesApplied(data)) return data
  return {
    ...data,
    extras: { ...data.extras, [FAMILY_SLEEVES_APPLIED_EXTRA]: FAMILY_SLEEVES_APPLIED_VERSION },
  }
}

export type FamilyEquitySleeve = {
  symbol: string
  name: string
  shares: number
  accountType?: EquityAccountType
}

export type FamilyCryptoSleeve = {
  symbol: string
  name: string
  qty: number
}

export type FamilyHoldingSleeve = {
  equities: readonly FamilyEquitySleeve[]
  crypto: readonly FamilyCryptoSleeve[]
}

const TSLA: FamilyEquitySleeve = { symbol: 'TSLA', name: 'Tesla, Inc.', shares: 0 }
const MSTR: FamilyEquitySleeve = {
  symbol: 'MSTR',
  name: 'MicroStrategy Incorporated',
  shares: 0,
}

export const FAMILY_HOLDING_SLEEVES: Readonly<Record<string, FamilyHoldingSleeve>> = {
  thomas: {
    equities: [
      { ...TSLA, shares: 100 },
      { ...MSTR, shares: 97 },
    ],
    crypto: [],
  },
  rebecca: {
    equities: [
      { ...TSLA, shares: 100 },
      { ...MSTR, shares: 97 },
    ],
    crypto: [],
  },
  mum: {
    equities: [
      { ...TSLA, shares: 109 },
      { ...MSTR, shares: 108 },
    ],
    crypto: [],
  },
  'james king': {
    equities: [
      { ...TSLA, shares: 182 },
      { ...MSTR, shares: 90 },
    ],
    crypto: [{ symbol: 'ADA', name: 'Cardano', qty: 3000 }],
  },
  andrew: {
    equities: [
      { ...TSLA, shares: 295, accountType: 'sipp' },
      { ...MSTR, shares: 197, accountType: 'sipp' },
      { ...TSLA, shares: 135, accountType: 'general' },
      { ...MSTR, shares: 112, accountType: 'general' },
    ],
    crypto: [{ symbol: 'ADA', name: 'Cardano', qty: 14285 }],
  },
}

export function familyHoldingSleeveKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function familyHoldingSleeveFor(name: string): FamilyHoldingSleeve | null {
  return FAMILY_HOLDING_SLEEVES[familyHoldingSleeveKey(name)] ?? null
}

function nextId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

function accountKey(accountType?: EquityAccountType): EquityAccountType {
  return accountType ?? 'general'
}

function upsertEquity(list: EquityHolding[], spec: FamilyEquitySleeve): EquityHolding[] {
  const want = accountKey(spec.accountType)
  const i = list.findIndex(
    (e) => e.symbol.trim().toUpperCase() === spec.symbol && accountKey(e.accountType) === want,
  )
  const storedType: EquityAccountType | undefined = want === 'general' ? undefined : want
  if (i >= 0) {
    const cur = list[i]!
    if (cur.shares === spec.shares && accountKey(cur.accountType) === want) return list
    const next = [...list]
    next[i] = {
      ...cur,
      shares: spec.shares,
      accountType: storedType,
      includeInPortfolio: cur.includeInPortfolio !== false,
    }
    return next
  }
  return [
    ...list,
    {
      id: nextId(list),
      symbol: spec.symbol,
      name: spec.name,
      shares: spec.shares,
      avgCost: 0,
      livePrice: 0,
      includeInPortfolio: true,
      accountType: storedType,
    },
  ]
}

function upsertCrypto(list: CryptoHolding[], spec: FamilyCryptoSleeve): CryptoHolding[] {
  const i = list.findIndex((c) => c.symbol.trim().toUpperCase() === spec.symbol)
  if (i >= 0) {
    const cur = list[i]!
    if (cur.qty === spec.qty) return list
    const next = [...list]
    next[i] = { ...cur, qty: spec.qty, includeInPortfolio: cur.includeInPortfolio !== false }
    return next
  }
  return [
    ...list,
    {
      id: nextId(list),
      symbol: spec.symbol,
      name: spec.name,
      qty: spec.qty,
      price: 0,
      cost: 0,
      includeInPortfolio: true,
    },
  ]
}

function accountOf(holding: { accountType?: EquityAccountType }): EquityAccountType {
  return accountKey(holding.accountType)
}

/** True when the gifted TSLA / MSTR / ADA rows are missing or the quantities do not match. */
export function familyBookMissingGiftedRows(data: PortfolioData, name: string): boolean {
  const sleeve = familyHoldingSleeveFor(name)
  if (!sleeve) return false
  const equities = data.equities ?? []
  const crypto = data.crypto ?? []
  for (const spec of sleeve.equities) {
    const row = equities.find(
      (e) => e.symbol.trim().toUpperCase() === spec.symbol && accountOf(e) === accountKey(spec.accountType),
    )
    if (!row || row.shares !== spec.shares) return true
  }
  for (const spec of sleeve.crypto) {
    const row = crypto.find((c) => c.symbol.trim().toUpperCase() === spec.symbol)
    if (!row || row.qty !== spec.qty) return true
  }
  return false
}

/** Set the named family book’s TSLA / MSTR / ADA quantities. No-op for David / unknown. */
export function applyNamedFamilyHoldings(
  data: PortfolioData,
  name: string,
): { data: PortfolioData; changed: boolean } {
  const sleeve = familyHoldingSleeveFor(name)
  if (!sleeve) return { data, changed: false }

  let equities = data.equities ?? []
  let crypto = data.crypto ?? []
  let changed = false

  for (const eq of sleeve.equities) {
    const next = upsertEquity(equities, eq)
    if (next !== equities) {
      equities = next
      changed = true
    }
  }
  for (const c of sleeve.crypto) {
    const next = upsertCrypto(crypto, c)
    if (next !== crypto) {
      crypto = next
      changed = true
    }
  }

  if (!changed) return { data, changed: false }
  return { data: { ...data, equities, crypto }, changed: true }
}
