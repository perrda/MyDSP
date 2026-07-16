import type { PortfolioData, RecurringTransaction } from './types'

export function advanceRecurringDue(
  date: string,
  frequency: RecurringTransaction['frequency'],
): string {
  const d = new Date(date)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
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
        createdAt: new Date().toISOString(),
      },
    ],
    recurringTransactions: data.recurringTransactions.map((x) =>
      x.id === id ? { ...x, nextDue: advanceRecurringDue(x.nextDue, x.frequency) } : x,
    ),
  }
}
