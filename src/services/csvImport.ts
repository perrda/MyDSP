/** Bank CSV import — Monzo-friendly + generic. */

import { guessCategory, resolveCategory } from '../domain/merchantRules'
import type { MerchantRule } from '../domain/types'

export interface ParsedBankRow {
  date: string
  description: string
  amount: number
  category: string
  selected: boolean
  /** True when CSV amount is inflow (income) — excluded from spend import by default */
  isIncome: boolean
}

export function parseCSVLine(line: string, delimiter = ','): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

export { guessCategory }

export function normalizeDate(dateStr: string): string {
  const raw = String(dateStr || '').trim()
  if (!raw) return raw
  // Already ISO date (or datetime) — keep calendar day without UTC shift.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  // UK-style d/m/y or d-m-y
  const parts = raw.split(/[/\-.]/)
  if (parts.length === 3 && parts[0]!.length <= 2 && parts[2]!.length >= 2) {
    const day = parts[0]!.padStart(2, '0')
    const month = parts[1]!.padStart(2, '0')
    const year = parts[2]!.length === 2 ? `20${parts[2]}` : parts[2]!
    if (/^\d{4}$/.test(year) && Number(month) >= 1 && Number(month) <= 12) {
      return `${year}-${month}-${day}`
    }
  }
  // Fallback: parse then use local calendar components (never toISOString — TZ shift).
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return raw
}

function findCol(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  for (const c of candidates) {
    const idx = lower.findIndex((h) => h.includes(c))
    if (idx >= 0) return idx
  }
  return -1
}

/**
 * Parse bank CSV text into preview rows.
 * Detects Monzo-style headers and generic Date/Description/Amount columns.
 * @param options.convention monzo: amount > 0 = income (default). positive_expense: amount > 0 = expense.
 */
export function parseBankCsv(
  text: string,
  rules: MerchantRule[] = [],
  options?: { convention?: 'monzo' | 'positive_expense' },
): ParsedBankRow[] {
  const convention = options?.convention ?? 'monzo'
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const dateCol = findCol(headers, ['date', 'time', 'created'])
  const descCol = findCol(headers, ['description', 'name', 'narrative', 'memo', 'merchant'])
  const amountCol = findCol(headers, ['amount', 'value', 'moneyout', 'moneyin'])
  const categoryCol = findCol(headers, ['category', 'categoryname'])

  const amountColResolved = amountCol >= 0 ? amountCol : 2
  const dateColResolved = dateCol >= 0 ? dateCol : 0
  const descColResolved = descCol >= 0 ? descCol : 1

  const rows: ParsedBankRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.every((c) => !c)) continue
    const date = normalizeDate(cols[dateColResolved] || '')
    const description = cols[descColResolved] || 'Transaction'
    const rawAmount = (cols[amountColResolved] || '0').replace(/[^-\d.]/g, '')
    const amount = parseFloat(rawAmount)
    if (!Number.isFinite(amount) || amount === 0) continue

    // monzo: positive = income; positive_expense: positive = expense (negate for internal sign)
    const isIncome = convention === 'positive_expense' ? amount < 0 : amount > 0
    const signedAmount =
      convention === 'positive_expense' ? -amount : amount
    const category =
      categoryCol >= 0 && cols[categoryCol]
        ? cols[categoryCol].toLowerCase()
        : resolveCategory(description, rules)

    rows.push({
      date,
      description,
      amount: signedAmount,
      category: isIncome && category === 'other' ? 'income' : category,
      selected: !isIncome,
      isIncome,
    })
  }
  return rows
}
