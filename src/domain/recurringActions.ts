import type { PortfolioData, RecurringTransaction } from './types'

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
  return {
    ...data,
    recurringTransactions: data.recurringTransactions.map((r) =>
      r.id === id ? { ...r, nextDue: advanceRecurringDue(r.nextDue, r.frequency) } : r,
    ),
  }
}

export function markRecurringPaid(data: PortfolioData, id: number): PortfolioData {
  const r = data.recurringTransactions.find((x) => x.id === id)
  if (!r) return data
  const now = new Date().toISOString()
  const spendId = data.spending.reduce((m, s) => Math.max(m, s.id), 0) + 1
  return {
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
  }
}
