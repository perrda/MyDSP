/** Parse dated buy/sell CSV for a holding. */

import type { TradeInput, TradeKind, TradeSide } from '../domain/trades'
import { levenshteinDistance } from '../utils/search'

export type TradeCsvDateOrder = 'dmy' | 'mdy'

export type BrokerTradePresetId = 'ibkr' | 'trading212' | 'coinbase' | 'generic'

export interface BrokerTradePreset {
  id: BrokerTradePresetId
  label: string
  /** Hint for ambiguous dates */
  dateOrder: TradeCsvDateOrder
}

function normalizeHeaderToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

/** Normalised aliases shared by holding-level and portfolio-level broker imports. */
export const TRADE_CSV_COLUMN_ALIASES = {
  date: [
    'date',
    'tradedate',
    'day',
    'tradedateutc',
    'time',
    'timestamp',
    'datetime',
    'settledate',
    'executiontime',
    'date/time',
    'datetimeutc',
  ],
  side: [
    'side',
    'type',
    'action',
    'buyorsell',
    'buy/sell',
    'buysell',
    'transactiontype',
    'ordertype',
    'b/s',
  ],
  symbol: ['symbol', 'ticker', 'asset', 'instrument', 'security', 'contract', 'product', 'productid'],
  qty: [
    'qty',
    'quantity',
    'shares',
    'amount',
    'units',
    'no.ofshares',
    'nofshares',
    'quantitytransacted',
    'filledqty',
    'sharesfilled',
    'fillquantity',
  ],
  price: [
    'price',
    'unitprice',
    'px',
    'fillprice',
    'avgprice',
    't.price',
    'tprice',
    'tradeprice',
    'price/share',
    'priceshare',
    'priceattransaction',
    'spotpriceattransaction',
    'avg.fillprice',
    'executedprice',
    'tradeprice/share',
  ],
  fee: [
    'fees',
    'fee',
    'commission',
    'comm',
    'comm/fee',
    'commfee',
    'totalfees',
    'feesand/orcommission',
    'ibcommission',
    'transactionfees',
  ],
} as const

const NOTES_COLUMN_ALIASES = ['notes', 'note', 'memo', 'comment', 'description'] as const
const PLATFORM_COLUMN_ALIASES = ['platform', 'broker', 'exchange', 'venue', 'account'] as const

const BROKER_PRESETS: BrokerTradePreset[] = [
  { id: 'ibkr', label: 'Interactive Brokers', dateOrder: 'mdy' },
  { id: 'trading212', label: 'Trading 212', dateOrder: 'dmy' },
  { id: 'coinbase', label: 'Coinbase', dateOrder: 'mdy' },
  { id: 'generic', label: 'Generic MyDSP CSV', dateOrder: 'dmy' },
]

export function listBrokerTradePresets(): BrokerTradePreset[] {
  return BROKER_PRESETS
}

/** Detect broker export from normalised header tokens. */
export function detectBrokerPreset(headers: string[]): BrokerTradePreset {
  const h = headers.map(normalizeHeaderToken)
  const has = (...names: string[]) => names.every((n) => h.includes(normalizeHeaderToken(n)))
  const any = (...names: string[]) =>
    names.some((n) => h.some((x) => x.includes(normalizeHeaderToken(n))))
  const exact = (...names: string[]) => names.some((n) => h.includes(normalizeHeaderToken(n)))

  // Coinbase before IBKR: "Spot Price…" contains the substring "tprice"
  if (
    any('quantitytransacted') ||
    any('spotpriceattransaction') ||
    exact('transactiontype') ||
    any('advancedtrade', 'productid') ||
    (any('spot price') && any('subtotal'))
  ) {
    return BROKER_PRESETS[2]
  }
  if (
    any('no.ofshares', 'nofshares') ||
    (exact('action') && exact('time') && any('price/share', 'priceshare', 'fillprice')) ||
    (any('trading212') && any('ticker')) ||
    (exact('ticker') && any('fill price', 'fillprice') && any('currency (price)', 'currencypirce', 'currencynprice'))
  ) {
    return BROKER_PRESETS[1]
  }
  if (
    exact('t.price', 'tprice') ||
    any('comm/fee') ||
    exact('commfee') ||
    (any('buy/sell') && exact('quantity')) ||
    (exact('tradedate') && any('buy/sell', 'buysell')) ||
    any('ibcommission', 'ibkr') ||
    (any('tradeprice') && any('ibcommission')) ||
    (exact('symbol') && any('proceeds') && any('ibcommission', 'comm/fee', 'commission'))
  ) {
    return BROKER_PRESETS[0]
  }
  if (has('date', 'side', 'qty', 'price') || has('date', 'side', 'quantity', 'price')) {
    return BROKER_PRESETS[3]
  }
  return BROKER_PRESETS[3]
}

export interface ParseTradeCsvOptions {
  kind: TradeKind
  symbol: string
  name?: string
  /** When day and month are both ≤12, prefer this order. Default UK `dmy`. */
  dateOrder?: TradeCsvDateOrder
}

export interface ParsedTradeCsv {
  trades: TradeInput[]
  errors: string[]
  broker?: BrokerTradePreset
  columnSuggestions?: ColumnAliasSuggestion[]
}

export interface ParsePortfolioTradeCsvOptions {
  kind: TradeKind
  /** Existing names keyed by uppercase symbol; used when imports create a holding. */
  namesBySymbol?: Map<string, string>
  dateOrder?: TradeCsvDateOrder
}

/**
 * Expected columns (header row, case-insensitive):
 * date,side|type,qty,price[,fees][,notes][,platform]
 * Extra columns (symbol, ticker, …) are ignored.
 */
export function parseTradeCsv(text: string, opts: ParseTradeCsvOptions): ParsedTradeCsv {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const errors: string[] = []
  if (lines.length === 0) return { trades: [], errors: ['Empty CSV — paste or choose a file with trade rows'] }

  const header = splitCsvLine(lines[0]).map(normalizeHeaderToken)
  const broker = detectBrokerPreset(header)
  const dateOrder = opts.dateOrder ?? broker.dateOrder
  const hasHeader = header.some(
    (h) =>
      h.includes('date') ||
      h.includes('qty') ||
      h.includes('side') ||
      h.includes('time') ||
      h.includes('action') ||
      h.includes('quantity') ||
      h.includes('transaction'),
  )
  const rows = hasHeader ? lines.slice(1) : lines
  const col = (names: readonly string[]) => {
    for (const n of names) {
      const i = header.indexOf(n)
      if (i >= 0) return i
    }
    return -1
  }

  const iDate = hasHeader ? col(TRADE_CSV_COLUMN_ALIASES.date) : 0
  const iSide = hasHeader ? col(TRADE_CSV_COLUMN_ALIASES.side) : 1
  const iQty = hasHeader ? col(TRADE_CSV_COLUMN_ALIASES.qty) : 2
  const iPrice = hasHeader ? col(TRADE_CSV_COLUMN_ALIASES.price) : 3
  const iFees = hasHeader ? col(TRADE_CSV_COLUMN_ALIASES.fee) : 4
  const iNotes = hasHeader ? col(NOTES_COLUMN_ALIASES) : 5
  const iPlatform = hasHeader ? col(PLATFORM_COLUMN_ALIASES) : 6

  if (iDate < 0 || iSide < 0 || iQty < 0 || iPrice < 0) {
    return {
      trades: [],
      errors: ['Need columns: date, side/type, qty, price'],
      broker,
    }
  }

  const trades: TradeInput[] = []
  rows.forEach((line, idx) => {
    const rowNum = idx + (hasHeader ? 2 : 1)
    const cells = splitCsvLine(line)
    if (cells.every((c) => !c.trim())) return

    const dateRaw = cells[iDate]?.trim() ?? ''
    const sideRaw = (cells[iSide] ?? '').trim().toLowerCase()
    const qty = Math.abs(parseCsvNumber(cells[iQty]))
    const price = parseCsvNumber(cells[iPrice])
    const fees = iFees >= 0 ? Math.abs(parseCsvNumber(cells[iFees]) || 0) : 0
    let notes = iNotes >= 0 ? cells[iNotes]?.trim() : undefined
    const platform = iPlatform >= 0 ? cells[iPlatform]?.trim() : undefined
    if (platform && notes) notes = `${notes} · ${platform}`
    else if (platform) notes = platform

    const date = normalizeDate(dateRaw, dateOrder)
    // Coinbase / exchange transfers are not buy/sell for cost basis.
    if (isTransferSide(sideRaw)) {
      errors.push(`Row ${rowNum}: skipped non-trade type “${sideRaw}”`)
      return
    }
    const side = parseTradeSide(sideRaw)

    if (!date) {
      errors.push(`Row ${rowNum}: unrecognised date “${dateRaw}”`)
      return
    }
    if (!side) {
      errors.push(`Row ${rowNum}: side must be buy or sell (got “${sideRaw || 'blank'}”)`)
      return
    }
    if (!(qty > 0)) {
      errors.push(`Row ${rowNum}: quantity must be greater than zero`)
      return
    }
    if (!(price >= 0) || Number.isNaN(price)) {
      errors.push(`Row ${rowNum}: invalid price`)
      return
    }

    trades.push({
      kind: opts.kind,
      side,
      symbol: opts.symbol,
      name: opts.name,
      date,
      qty,
      price,
      fees,
      notes: notes || undefined,
      platform: platform || undefined,
    })
  })

  if (trades.length === 0 && errors.length === 0) {
    errors.push('No trade rows found')
  }

  return { trades, errors, broker }
}

/**
 * Portfolio-level broker stub: date,type/side,symbol,qty,price[,fees][,notes][,platform].
 * Unlike parseTradeCsv, this honours the CSV symbol column and can append multiple symbols.
 */

export interface ColumnAliasSuggestion {
  header: string
  suggestedField: keyof typeof TRADE_CSV_COLUMN_ALIASES
  alias: string
  score: number
}

/** Rank unmatched CSV headers against known trade column aliases. */
export function suggestColumnAliases(headers: string[]): ColumnAliasSuggestion[] {
  const known = new Set<string>()
  for (const aliases of Object.values(TRADE_CSV_COLUMN_ALIASES)) {
    for (const alias of aliases) known.add(alias)
  }
  for (const alias of NOTES_COLUMN_ALIASES) known.add(alias)
  for (const alias of PLATFORM_COLUMN_ALIASES) known.add(alias)

  const fields = Object.keys(TRADE_CSV_COLUMN_ALIASES) as Array<keyof typeof TRADE_CSV_COLUMN_ALIASES>
  const out: ColumnAliasSuggestion[] = []
  for (const raw of headers) {
    const header = normalizeHeaderToken(raw)
    if (!header || known.has(header)) continue
    let best: ColumnAliasSuggestion | null = null
    for (const field of fields) {
      for (const alias of TRADE_CSV_COLUMN_ALIASES[field]) {
        const dist = levenshteinDistance(header, alias)
        const maxLen = Math.max(header.length, alias.length) || 1
        const score = 1 - dist / maxLen
        if (score < 0.55) continue
        if (!best || score > best.score) {
          best = { header: raw.trim() || header, suggestedField: field, alias, score }
        }
      }
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => b.score - a.score || a.header.localeCompare(b.header))
}

export function parsePortfolioTradeCsv(
  text: string,
  opts: ParsePortfolioTradeCsvOptions,
): ParsedTradeCsv {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const errors: string[] = []
  if (lines.length === 0) return { trades: [], errors: ['Empty CSV — choose a file with trade rows'] }

  const header = splitCsvLine(lines[0]).map(normalizeHeaderToken)
  const broker = detectBrokerPreset(header)
  const dateOrder = opts.dateOrder ?? broker.dateOrder
  const rows = lines.slice(1)
  const col = (names: readonly string[]) => {
    for (const n of names) {
      const i = header.indexOf(n)
      if (i >= 0) return i
    }
    return -1
  }

  const iDate = col(TRADE_CSV_COLUMN_ALIASES.date)
  const iSide = col(TRADE_CSV_COLUMN_ALIASES.side)
  const iSymbol = col(TRADE_CSV_COLUMN_ALIASES.symbol)
  const iQty = col(TRADE_CSV_COLUMN_ALIASES.qty)
  const iPrice = col(TRADE_CSV_COLUMN_ALIASES.price)
  const iFees = col(TRADE_CSV_COLUMN_ALIASES.fee)
  const iNotes = col(NOTES_COLUMN_ALIASES)
  const iPlatform = col(PLATFORM_COLUMN_ALIASES)

  if (iDate < 0 || iSide < 0 || iSymbol < 0 || iQty < 0 || iPrice < 0) {
    const columnSuggestions = suggestColumnAliases(header)
    const suggestionLines = columnSuggestions.slice(0, 5).map(
      (s) => `Unknown column “${s.header}” → try ${s.suggestedField} (like “${s.alias}”)`,
    )
    return {
      trades: [],
      errors: ['Need columns: date, type/side, symbol, qty, price', ...suggestionLines],
      broker,
      columnSuggestions,
    }
  }

  const trades: TradeInput[] = []
  rows.forEach((line, idx) => {
    const rowNum = idx + 2
    const cells = splitCsvLine(line)
    if (cells.every((c) => !c.trim())) return

    const dateRaw = cells[iDate]?.trim() ?? ''
    const sideRaw = (cells[iSide] ?? '').trim().toLowerCase()
    const symbol = (cells[iSymbol] ?? '').trim().toUpperCase().replace(/^\$/, '')
    const qty = Math.abs(parseCsvNumber(cells[iQty]))
    const price = parseCsvNumber(cells[iPrice])
    const fees = iFees >= 0 ? Math.abs(parseCsvNumber(cells[iFees]) || 0) : 0
    let notes = iNotes >= 0 ? cells[iNotes]?.trim() : undefined
    const platform = iPlatform >= 0 ? cells[iPlatform]?.trim() : undefined
    if (platform && notes) notes = `${notes} · ${platform}`
    else if (platform) notes = platform

    const date = normalizeDate(dateRaw, dateOrder)
    if (isTransferSide(sideRaw)) {
      errors.push(`Row ${rowNum}: skipped non-trade type “${sideRaw}”`)
      return
    }
    const side = parseTradeSide(sideRaw)

    if (!date) {
      errors.push(`Row ${rowNum}: unrecognised date “${dateRaw}”`)
      return
    }
    if (!side) {
      errors.push(`Row ${rowNum}: type must be buy or sell (got “${sideRaw || 'blank'}”)`)
      return
    }
    if (!symbol) {
      errors.push(`Row ${rowNum}: missing symbol`)
      return
    }
    if (!(qty > 0)) {
      errors.push(`Row ${rowNum}: quantity must be greater than zero`)
      return
    }
    if (!(price >= 0) || Number.isNaN(price)) {
      errors.push(`Row ${rowNum}: invalid price`)
      return
    }

    trades.push({
      kind: opts.kind,
      side,
      symbol,
      name: opts.namesBySymbol?.get(symbol),
      date,
      qty,
      price,
      fees,
      notes: notes || undefined,
      platform: platform || undefined,
    })
  })

  if (trades.length === 0 && errors.length === 0) errors.push('No trade rows found')
  return { trades, errors, broker }
}

function parseCsvNumber(value: string | undefined): number {
  const raw = String(value ?? '').trim()
  const isParenthesizedNegative = /^\(.*\)$/.test(raw)
  const parsed = Number(raw.replace(/[()£$€,\s]/g, ''))
  return isParenthesizedNegative ? -Math.abs(parsed) : parsed
}

function isTransferSide(side: string): boolean {
  return ['send', 'receive', 'transfer', 'convert', 'deposit', 'withdraw'].some((type) =>
    side.includes(type),
  )
}

function parseTradeSide(side: string): TradeSide | null {
  if (
    side === 'buy' ||
    side === 'b' ||
    side === 'purchase' ||
    side === 'bought' ||
    side.includes('buy')
  ) {
    return 'buy'
  }
  if (
    side === 'sell' ||
    side === 's' ||
    side === 'sale' ||
    side === 'sold' ||
    side.includes('sell')
  ) {
    return 'sell'
  }
  return null
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQ = !inQ
      continue
    }
    if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

/** Exported for unit tests. */
export function normalizeTradeCsvDate(
  raw: string,
  dateOrder: TradeCsvDateOrder = 'dmy',
): string | null {
  return normalizeDate(raw, dateOrder)
}

function normalizeDate(raw: string, dateOrder: TradeCsvDateOrder): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const y = m[3]
    let day: number
    let month: number
    if (a > 12 && b <= 12) {
      // Clearly D/M/Y
      day = a
      month = b
    } else if (b > 12 && a <= 12) {
      // Clearly M/D/Y
      month = a
      day = b
    } else if (dateOrder === 'mdy') {
      month = a
      day = b
    } else {
      // Default UK D/M/Y
      day = a
      month = b
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const t = Date.parse(s)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}
