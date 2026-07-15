/** Parse dated buy/sell CSV for a holding. */

import type { TradeInput, TradeKind, TradeSide } from '../domain/trades'

export type TradeCsvDateOrder = 'dmy' | 'mdy'

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
}

/**
 * Expected columns (header row, case-insensitive):
 * date,side|type,qty,price[,fees][,notes][,platform]
 * Extra columns (symbol, ticker, …) are ignored.
 */
export function parseTradeCsv(text: string, opts: ParseTradeCsvOptions): ParsedTradeCsv {
  const dateOrder = opts.dateOrder ?? 'dmy'
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const errors: string[] = []
  if (lines.length === 0) return { trades: [], errors: ['Empty CSV — paste or choose a file with trade rows'] }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''))
  const hasHeader = header.some((h) => h.includes('date') || h.includes('qty') || h.includes('side'))
  const rows = hasHeader ? lines.slice(1) : lines
  const col = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n)
      if (i >= 0) return i
    }
    return -1
  }

  const iDate = hasHeader ? col(['date', 'tradedate', 'day', 'tradedateutc']) : 0
  const iSide = hasHeader ? col(['side', 'type', 'action', 'buyorsell', 'buysell']) : 1
  const iQty = hasHeader ? col(['qty', 'quantity', 'shares', 'amount', 'units']) : 2
  const iPrice = hasHeader ? col(['price', 'unitprice', 'px', 'fillprice', 'avgprice']) : 3
  const iFees = hasHeader ? col(['fees', 'fee', 'commission', 'comm']) : 4
  const iNotes = hasHeader ? col(['notes', 'note', 'memo', 'comment']) : 5
  const iPlatform = hasHeader ? col(['platform', 'broker', 'exchange', 'venue']) : 6

  if (iDate < 0 || iSide < 0 || iQty < 0 || iPrice < 0) {
    return {
      trades: [],
      errors: ['Need columns: date, side/type, qty, price'],
    }
  }

  const trades: TradeInput[] = []
  rows.forEach((line, idx) => {
    const rowNum = idx + (hasHeader ? 2 : 1)
    const cells = splitCsvLine(line)
    if (cells.every((c) => !c.trim())) return

    const dateRaw = cells[iDate]?.trim() ?? ''
    const sideRaw = (cells[iSide] ?? '').trim().toLowerCase()
    const qty = Number(String(cells[iQty] ?? '').replace(/,/g, ''))
    const price = Number(String(cells[iPrice] ?? '').replace(/[£$€,\s]/g, ''))
    const fees =
      iFees >= 0 ? Number(String(cells[iFees] ?? '0').replace(/[£$€,\s]/g, '')) || 0 : 0
    let notes = iNotes >= 0 ? cells[iNotes]?.trim() : undefined
    const platform = iPlatform >= 0 ? cells[iPlatform]?.trim() : undefined
    if (platform && notes) notes = `${notes} · ${platform}`
    else if (platform) notes = platform

    const date = normalizeDate(dateRaw, dateOrder)
    let side: TradeSide | null = null
    if (sideRaw === 'buy' || sideRaw === 'b' || sideRaw === 'purchase' || sideRaw === 'bought') {
      side = 'buy'
    }
    if (sideRaw === 'sell' || sideRaw === 's' || sideRaw === 'sale' || sideRaw === 'sold') {
      side = 'sell'
    }

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

  return { trades, errors }
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
