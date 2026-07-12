/** Parse dated buy/sell CSV for a holding. */

import type { TradeInput, TradeKind, TradeSide } from '../domain/trades'

export interface ParsedTradeCsv {
  trades: TradeInput[]
  errors: string[]
}

/**
 * Expected columns (header row, case-insensitive):
 * date,side|type,qty,price[,fees][,notes][,platform]
 */
export function parseTradeCsv(
  text: string,
  opts: { kind: TradeKind; symbol: string; name?: string },
): ParsedTradeCsv {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const errors: string[] = []
  if (lines.length === 0) return { trades: [], errors: ['Empty file'] }

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

  const iDate = hasHeader ? col(['date', 'tradedate', 'day']) : 0
  const iSide = hasHeader ? col(['side', 'type', 'action', 'buyorsell']) : 1
  const iQty = hasHeader ? col(['qty', 'quantity', 'shares', 'amount']) : 2
  const iPrice = hasHeader ? col(['price', 'unitprice', 'px']) : 3
  const iFees = hasHeader ? col(['fees', 'fee', 'commission']) : 4
  const iNotes = hasHeader ? col(['notes', 'note', 'memo']) : 5
  const iPlatform = hasHeader ? col(['platform', 'broker', 'exchange']) : 6

  if (iDate < 0 || iSide < 0 || iQty < 0 || iPrice < 0) {
    return {
      trades: [],
      errors: ['Need columns: date, side/type, qty, price'],
    }
  }

  const trades: TradeInput[] = []
  rows.forEach((line, idx) => {
    const cells = splitCsvLine(line)
    const dateRaw = cells[iDate]?.trim() ?? ''
    const sideRaw = (cells[iSide] ?? '').trim().toLowerCase()
    const qty = Number(String(cells[iQty] ?? '').replace(/,/g, ''))
    const price = Number(String(cells[iPrice] ?? '').replace(/,/g, ''))
    const fees = iFees >= 0 ? Number(String(cells[iFees] ?? '0').replace(/,/g, '')) || 0 : 0
    const notes = iNotes >= 0 ? cells[iNotes]?.trim() : undefined
    const platform = iPlatform >= 0 ? cells[iPlatform]?.trim() : undefined

    const date = normalizeDate(dateRaw)
    let side: TradeSide | null = null
    if (sideRaw === 'buy' || sideRaw === 'b' || sideRaw === 'purchase') side = 'buy'
    if (sideRaw === 'sell' || sideRaw === 's' || sideRaw === 'sale') side = 'sell'

    if (!date || !side || !(qty > 0) || !(price >= 0)) {
      errors.push(`Row ${idx + (hasHeader ? 2 : 1)}: invalid date/side/qty/price`)
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

function normalizeDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = m[3]
    // Prefer D/M/Y (UK) when day > 12
    if (d > 12) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const t = Date.parse(raw)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}
