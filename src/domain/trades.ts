/** Rebuild holding qty/cost from journal buy/sell legs (chronological average cost). */

import type {
  CryptoHolding,
  EquityHolding,
  JournalEntry,
  PortfolioData,
} from './types'

export type TradeKind = 'crypto' | 'equity'
export type TradeSide = 'buy' | 'sell'

export interface TradeInput {
  kind: TradeKind
  side: TradeSide
  symbol: string
  name?: string
  date: string
  qty: number
  price: number
  fees?: number
  notes?: string
  platform?: string
  holdingId?: number
}

export interface TradeDraftRow {
  id: string
  side: TradeSide
  date: string
  qty: string
  price: string
  fees: string
  notes: string
}

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

export function tradeTotal(side: TradeSide, qty: number, price: number, fees: number): number {
  const notional = qty * price
  return side === 'buy' ? notional + fees : Math.max(0, notional - fees)
}

export function isTradeType(type: string): type is TradeSide {
  const t = type.toLowerCase()
  return t === 'buy' || t === 'sell'
}

export function applyCryptoTrade(
  holding: CryptoHolding,
  side: TradeSide,
  qty: number,
  price: number,
  fees: number,
): CryptoHolding {
  if (!(qty > 0) || !(price >= 0)) return holding
  if (side === 'buy') {
    const spend = qty * price + fees
    return {
      ...holding,
      qty: holding.qty + qty,
      cost: holding.cost + spend,
      price: price > 0 ? price : holding.price,
    }
  }
  const sellQty = Math.min(qty, holding.qty)
  if (sellQty <= 0) return holding
  const costPer = holding.qty > 0 ? holding.cost / holding.qty : 0
  return {
    ...holding,
    qty: holding.qty - sellQty,
    cost: Math.max(0, holding.cost - costPer * sellQty),
    price: price > 0 ? price : holding.price,
  }
}

export function applyEquityTrade(
  holding: EquityHolding,
  side: TradeSide,
  qty: number,
  price: number,
  fees: number,
): EquityHolding {
  if (!(qty > 0) || !(price >= 0)) return holding
  if (side === 'buy') {
    const spend = qty * price + fees
    const newShares = holding.shares + qty
    const oldCost = holding.shares * holding.avgCost
    const avgCost = newShares > 0 ? (oldCost + spend) / newShares : 0
    return {
      ...holding,
      shares: newShares,
      avgCost,
      livePrice: price > 0 ? price : holding.livePrice,
    }
  }
  const sellQty = Math.min(qty, holding.shares)
  if (sellQty <= 0) return holding
  return {
    ...holding,
    shares: holding.shares - sellQty,
    livePrice: price > 0 ? price : holding.livePrice,
  }
}

function inferKind(data: PortfolioData, symbol: string, hint?: TradeKind): TradeKind {
  const s = symbol.toUpperCase()
  if (hint) return hint
  if (data.crypto.some((c) => c.symbol.toUpperCase() === s)) return 'crypto'
  if (data.equities.some((e) => e.symbol.toUpperCase() === s)) return 'equity'
  const cryptoish = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'AVAX', 'LINK', 'DOGE', 'USDC', 'NIGHT']
  return cryptoish.includes(s) ? 'crypto' : 'equity'
}

function replaySymbol(
  data: PortfolioData,
  symbol: string,
  kind: TradeKind,
  trades: JournalEntry[],
): { crypto?: CryptoHolding; equity?: EquityHolding } {
  const sorted = trades
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)

  if (kind === 'crypto') {
    const base = data.crypto.find((c) => c.symbol.toUpperCase() === symbol)
    let h: CryptoHolding = base
      ? { ...base, qty: 0, cost: 0 }
      : {
          id: nextId(data.crypto),
          symbol,
          name: symbol,
          qty: 0,
          price: 0,
          cost: 0,
          includeInPortfolio: true,
        }
    for (const j of sorted) {
      h = applyCryptoTrade(h, j.type.toLowerCase() as TradeSide, j.qty, j.price, j.fees || 0)
    }
    return { crypto: h }
  }

  const base = data.equities.find((e) => e.symbol.toUpperCase() === symbol)
  let h: EquityHolding = base
    ? { ...base, shares: 0, avgCost: 0 }
    : {
        id: nextId(data.equities),
        symbol,
        name: symbol,
        shares: 0,
        avgCost: 0,
        livePrice: 0,
        includeInPortfolio: true,
      }
  for (const j of sorted) {
    h = applyEquityTrade(h, j.type.toLowerCase() as TradeSide, j.qty, j.price, j.fees || 0)
  }
  return { equity: h }
}

/**
 * Replay buy/sell journal into holding qty/cost.
 * If onlySymbol is set, only that symbol is rebuilt; others unchanged.
 */
export function rebuildHoldingsFromJournal(
  data: PortfolioData,
  opts?: { onlySymbol?: string; kindHint?: TradeKind },
): PortfolioData {
  const only = opts?.onlySymbol?.toUpperCase()
  const tradeJournal = data.journal.filter((j) => isTradeType(j.type))

  const symbols = new Set<string>()
  for (const j of tradeJournal) {
    const s = j.asset.trim().toUpperCase()
    if (!s) continue
    if (!only || s === only) symbols.add(s)
  }
  if (only) symbols.add(only)

  let crypto = [...data.crypto]
  let equities = [...data.equities]

  for (const symbol of symbols) {
    const kind = inferKind(data, symbol, opts?.kindHint)
    const trades = tradeJournal.filter((j) => j.asset.toUpperCase() === symbol)
    const result = replaySymbol(data, symbol, kind, trades)

    if (kind === 'crypto' && result.crypto) {
      const i = crypto.findIndex((c) => c.symbol.toUpperCase() === symbol)
      if (i >= 0) crypto[i] = result.crypto
      else if (trades.length > 0) crypto.push(result.crypto)
    }
    if (kind === 'equity' && result.equity) {
      const i = equities.findIndex((e) => e.symbol.toUpperCase() === symbol)
      if (i >= 0) equities[i] = result.equity
      else if (trades.length > 0) equities.push(result.equity)
    }
  }

  return { ...data, crypto, equities }
}

export function applyTradesBatch(data: PortfolioData, trades: TradeInput[]): PortfolioData {
  if (trades.length === 0) return data
  let journal = [...data.journal]
  let nextJournalId = nextId(journal)
  let crypto = [...data.crypto]
  let equities = [...data.equities]
  const symbols = new Set<string>()

  for (const trade of trades) {
    const symbol = trade.symbol.trim().toUpperCase()
    if (!symbol || !(trade.qty > 0)) continue
    const fees = trade.fees ?? 0
    symbols.add(symbol)
    journal.push({
      id: nextJournalId++,
      date: trade.date.slice(0, 10),
      type: trade.side,
      asset: symbol,
      qty: trade.qty,
      price: trade.price,
      fees,
      total: tradeTotal(trade.side, trade.qty, trade.price, fees),
      notes: trade.notes?.trim() || undefined,
      platform: trade.platform?.trim() || undefined,
    })
    if (trade.kind === 'crypto' && !crypto.some((c) => c.symbol.toUpperCase() === symbol)) {
      crypto.push({
        id: nextId(crypto),
        symbol,
        name: trade.name?.trim() || symbol,
        qty: 0,
        price: trade.price,
        cost: 0,
        includeInPortfolio: true,
      })
    }
    if (trade.kind === 'equity' && !equities.some((e) => e.symbol.toUpperCase() === symbol)) {
      equities.push({
        id: nextId(equities),
        symbol,
        name: trade.name?.trim() || symbol,
        shares: 0,
        avgCost: 0,
        livePrice: trade.price,
        includeInPortfolio: true,
      })
    }
  }

  let next: PortfolioData = { ...data, crypto, equities, journal }
  for (const sym of symbols) {
    const kind = trades.find((t) => t.symbol.toUpperCase() === sym)?.kind
    next = rebuildHoldingsFromJournal(next, { onlySymbol: sym, kindHint: kind })
  }
  return next
}

export function applyTrade(data: PortfolioData, trade: TradeInput): PortfolioData {
  return applyTradesBatch(data, [trade])
}

export function upsertJournalTrade(
  data: PortfolioData,
  entry: JournalEntry,
  kind: TradeKind,
): PortfolioData {
  const symbol = entry.asset.trim().toUpperCase()
  const exists = data.journal.some((j) => j.id === entry.id)
  const journal = exists
    ? data.journal.map((j) => (j.id === entry.id ? { ...entry, asset: symbol } : j))
    : [
        ...data.journal,
        { ...entry, asset: symbol, id: entry.id > 0 ? entry.id : nextId(data.journal) },
      ]

  let crypto = [...data.crypto]
  let equities = [...data.equities]
  if (kind === 'crypto' && !crypto.some((c) => c.symbol.toUpperCase() === symbol)) {
    crypto.push({
      id: nextId(crypto),
      symbol,
      name: symbol,
      qty: 0,
      price: entry.price,
      cost: 0,
      includeInPortfolio: true,
    })
  }
  if (kind === 'equity' && !equities.some((e) => e.symbol.toUpperCase() === symbol)) {
    equities.push({
      id: nextId(equities),
      symbol,
      name: symbol,
      shares: 0,
      avgCost: 0,
      livePrice: entry.price,
      includeInPortfolio: true,
    })
  }

  return rebuildHoldingsFromJournal({ ...data, crypto, equities, journal }, {
    onlySymbol: symbol,
    kindHint: kind,
  })
}

export function deleteJournalTrade(
  data: PortfolioData,
  tradeId: number,
  kind: TradeKind,
  symbol: string,
): PortfolioData {
  const journal = data.journal.filter((j) => j.id !== tradeId)
  return rebuildHoldingsFromJournal({ ...data, journal }, {
    onlySymbol: symbol.toUpperCase(),
    kindHint: kind,
  })
}

export function journalForSymbol(data: PortfolioData, symbol: string): JournalEntry[] {
  const s = symbol.toUpperCase()
  return data.journal
    .filter((j) => j.asset.toUpperCase() === s)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
}

export function tradeJournalForSymbol(data: PortfolioData, symbol: string): JournalEntry[] {
  return journalForSymbol(data, symbol).filter((j) => isTradeType(j.type))
}

/** Holding has qty/cost but no buy/sell journal — typical after FCC import. */
export function needsOpeningBalance(
  data: PortfolioData,
  symbol: string,
  kind: TradeKind,
): boolean {
  const trades = tradeJournalForSymbol(data, symbol)
  if (trades.length > 0) return false
  if (kind === 'crypto') {
    const h = data.crypto.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase())
    return !!h && h.qty > 0
  }
  const h = data.equities.find((e) => e.symbol.toUpperCase() === symbol.toUpperCase())
  return !!h && h.shares > 0
}

export function openingBalanceDraft(
  data: PortfolioData,
  symbol: string,
  kind: TradeKind,
): TradeInput | null {
  const s = symbol.toUpperCase()
  if (kind === 'crypto') {
    const h = data.crypto.find((c) => c.symbol.toUpperCase() === s)
    if (!h || !(h.qty > 0)) return null
    const unit = h.qty > 0 ? h.cost / h.qty : 0
    return {
      kind: 'crypto',
      side: 'buy',
      symbol: s,
      name: h.name,
      date: '2010-01-01',
      qty: h.qty,
      price: unit,
      fees: 0,
      notes: 'Opening balance (from imported position)',
      holdingId: h.id,
    }
  }
  const h = data.equities.find((e) => e.symbol.toUpperCase() === s)
  if (!h || !(h.shares > 0)) return null
  return {
    kind: 'equity',
    side: 'buy',
    symbol: s,
    name: h.name,
    date: '2010-01-01',
    qty: h.shares,
    price: h.avgCost,
    fees: 0,
    notes: 'Opening balance (from imported position)',
    holdingId: h.id,
  }
}

export function applyOpeningBalance(
  data: PortfolioData,
  symbol: string,
  kind: TradeKind,
  date?: string,
): PortfolioData {
  const draft = openingBalanceDraft(data, symbol, kind)
  if (!draft) return data
  if (date) draft.date = date.slice(0, 10)
  return applyTrade(data, draft)
}

/** Remove all buy/sell journal rows for a symbol, then optionally append new trades. */
export function replaceSymbolTrades(
  data: PortfolioData,
  symbol: string,
  kind: TradeKind,
  trades: TradeInput[],
): PortfolioData {
  const s = symbol.toUpperCase()
  const journal = data.journal.filter(
    (j) => !(j.asset.toUpperCase() === s && isTradeType(j.type)),
  )
  const cleared = rebuildHoldingsFromJournal({ ...data, journal }, {
    onlySymbol: s,
    kindHint: kind,
  })
  if (trades.length === 0) return cleared
  return applyTradesBatch(cleared, trades.map((t) => ({ ...t, symbol: s, kind })))
}

export function emptyTradeDraftRow(side: TradeSide = 'buy'): TradeDraftRow {
  return {
    id: `r_${Math.random().toString(36).slice(2, 9)}`,
    side,
    date: new Date().toISOString().slice(0, 10),
    qty: '',
    price: '',
    fees: '0',
    notes: '',
  }
}
