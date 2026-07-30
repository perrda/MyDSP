import type { PortfolioData, RecurringTransaction, SpendingCategory, SpendingEntry } from './types'

export interface RecurringPaidUndo {
  id: number
  nextDue: string
  lastPaidAt?: string
  spendId: number
}

export interface RecurringSkipUndo {
  id: number
  nextDue: string
}

/** Append a spending row (same shape as markRecurringPaid). Returns updated data + new id. */
export function appendSpendingEntry(
  data: PortfolioData,
  entry: {
    date: string
    description: string
    amount: number
    category: SpendingCategory
    method?: SpendingEntry['method']
  },
): { data: PortfolioData; spendId: number } {
  const now = new Date().toISOString()
  const spendId = data.spending.reduce((m, s) => Math.max(m, s.id), 0) + 1
  return {
    spendId,
    data: {
      ...data,
      spending: [
        ...data.spending,
        {
          id: spendId,
          date: entry.date,
          description: entry.description,
          amount: Math.abs(entry.amount),
          category: entry.category,
          method: entry.method ?? 'debit',
          createdAt: now,
        },
      ],
    },
  }
}

/** Calendar-safe date-only advance (avoids UTC/local and month-end rollover bugs). */
export function advanceRecurringDue(
  date: string,
  frequency: RecurringTransaction['frequency'],
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim())
  const y = m ? Number(m[1]) : new Date(date).getFullYear()
  const mo = m ? Number(m[2]) - 1 : new Date(date).getMonth()
  const day = m ? Number(m[3]) : new Date(date).getDate()

  if (frequency === 'weekly') {
    const d = new Date(Date.UTC(y, mo, day))
    d.setUTCDate(d.getUTCDate() + 7)
    return d.toISOString().slice(0, 10)
  }
  if (frequency === 'yearly') {
    return clampDay(y + 1, mo, day)
  }
  // monthly
  const nextMo = mo + 1
  const ny = y + Math.floor(nextMo / 12)
  const nm = ((nextMo % 12) + 12) % 12
  return clampDay(ny, nm, day)
}

function clampDay(year: number, month0: number, day: number): string {
  const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const d = Math.min(day, last)
  const mm = String(month0 + 1).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export function skipRecurringOccurrence(data: PortfolioData, id: number): PortfolioData {
  return skipRecurringOccurrenceWithUndo(data, id).data
}

export function skipRecurringOccurrenceWithUndo(
  data: PortfolioData,
  id: number,
): { data: PortfolioData; undo: RecurringSkipUndo | null } {
  const recurring = data.recurringTransactions.find((r) => r.id === id)
  if (!recurring) return { data, undo: null }
  return {
    undo: { id, nextDue: recurring.nextDue },
    data: {
      ...data,
      recurringTransactions: data.recurringTransactions.map((r) =>
        r.id === id ? { ...r, nextDue: advanceRecurringDue(r.nextDue, r.frequency) } : r,
      ),
    },
  }
}

export function markRecurringPaid(data: PortfolioData, id: number): PortfolioData {
  return markRecurringPaidWithUndo(data, id).data
}

export function markRecurringPaidWithUndo(
  data: PortfolioData,
  id: number,
): { data: PortfolioData; undo: RecurringPaidUndo | null } {
  const r = data.recurringTransactions.find((x) => x.id === id)
  if (!r) return { data, undo: null }
  const now = new Date().toISOString()
  const spendId = data.spending.reduce((m, s) => Math.max(m, s.id), 0) + 1
  return {
    undo: {
      id,
      nextDue: r.nextDue,
      lastPaidAt: r.lastPaidAt,
      spendId,
    },
    data: {
      ...data,
      spending: [
        ...data.spending,
        {
          id: spendId,
          date: r.nextDue,
          description: r.name,
          amount: Math.abs(r.amount),
          category: r.category,
          method: 'debit',
          createdAt: now,
        },
      ],
      recurringTransactions: data.recurringTransactions.map((x) =>
        x.id === id
          ? {
              ...x,
              nextDue: advanceRecurringDue(x.nextDue, x.frequency),
              lastPaidAt: now,
            }
          : x,
      ),
    },
  }
}

export function undoRecurringPaid(data: PortfolioData, undo: RecurringPaidUndo): PortfolioData {
  return {
    ...data,
    spending: data.spending.filter((entry) => entry.id !== undo.spendId),
    recurringTransactions: data.recurringTransactions.map((r) =>
      r.id === undo.id
        ? { ...r, nextDue: undo.nextDue, lastPaidAt: undo.lastPaidAt }
        : r,
    ),
  }
}

export function undoRecurringSkip(data: PortfolioData, undo: RecurringSkipUndo): PortfolioData {
  return {
    ...data,
    recurringTransactions: data.recurringTransactions.map((r) =>
      r.id === undo.id ? { ...r, nextDue: undo.nextDue } : r,
    ),
  }
}
