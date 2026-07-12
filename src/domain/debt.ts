import type { CreditCard, Loan } from './types'

export type DebtStrategy = 'avalanche' | 'snowball' | 'hybrid'

export interface SimDebt {
  id: number
  name: string
  balance: number
  apr: number
  minPay: number
  type: 'cc' | 'loan'
}

export interface SimMonth {
  month: number
  payment: number
  principal: number
  interest: number
  remaining: number
  notes: string
}

export interface SimResult {
  totalInt: number
  months: number
  payoffs: Record<string, number>
  schedule: SimMonth[]
  baseMin: number
}

export function getDebts(creditCards: CreditCard[], loans: Loan[]): SimDebt[] {
  const debts: SimDebt[] = []
  for (const c of creditCards) {
    if (c.includeInPortfolio === false) continue
    debts.push({
      id: c.id,
      name: c.name,
      balance: c.balance,
      apr: c.apr,
      minPay: c.minPay,
      type: 'cc',
    })
  }
  for (const l of loans) {
    if (l.includeInPortfolio === false) continue
    debts.push({
      id: l.id,
      name: l.name,
      balance: l.balance,
      apr: l.apr,
      minPay: l.minPay,
      type: 'loan',
    })
  }
  return debts
}

export function sortDebts(strategy: DebtStrategy, debts: SimDebt[]): SimDebt[] {
  const list = [...debts]
  if (strategy === 'avalanche') return list.sort((a, b) => b.apr - a.apr)
  if (strategy === 'snowball') return list.sort((a, b) => a.balance - b.balance)
  return list.sort((a, b) => {
    if (a.type === 'cc' && b.type !== 'cc') return -1
    if (a.type !== 'cc' && b.type === 'cc') return 1
    return b.apr - a.apr
  })
}

/** Month-by-month debt payoff simulation (FCC parity, max 120 months). */
export function simulateDebt(
  creditCards: CreditCard[],
  loans: Loan[],
  strategy: DebtStrategy,
  extra: number,
): SimResult {
  const debts = getDebts(creditCards, loans).map((d) => ({ ...d }))
  const baseMin = debts.reduce((s, d) => s + d.minPay, 0)
  let totalInt = 0
  let months = 0
  const payoffs: Record<string, number> = {}
  const schedule: SimMonth[] = []

  while (debts.some((d) => d.balance > 0) && months < 120) {
    months++
    let monthInt = 0
    let monthPrin = 0
    const notes: string[] = []

    for (const d of debts) {
      if (d.balance > 0) {
        const int = (d.balance * (d.apr / 100)) / 12
        d.balance += int
        monthInt += int
        totalInt += int
      }
    }

    for (const d of debts) {
      if (d.balance > 0) {
        const pay = Math.min(d.minPay, d.balance)
        d.balance -= pay
        monthPrin += pay
        if (d.balance <= 0.01) {
          d.balance = 0
          const key = `${d.id}${d.type}`
          if (!payoffs[key]) {
            payoffs[key] = months
            notes.push(d.name)
          }
        }
      }
    }

    let avail = extra
    const sorted = sortDebts(
      strategy,
      debts.filter((d) => d.balance > 0),
    )
    for (const d of sorted) {
      if (avail <= 0 || d.balance <= 0) continue
      const apply = Math.min(avail, d.balance)
      d.balance -= apply
      monthPrin += apply
      avail -= apply
      if (d.balance <= 0.01) {
        d.balance = 0
        const key = `${d.id}${d.type}`
        if (!payoffs[key]) {
          payoffs[key] = months
          notes.push(d.name)
        }
      }
    }

    const remaining = debts.reduce((s, d) => s + d.balance, 0)
    schedule.push({
      month: months,
      payment: baseMin + extra,
      principal: monthPrin,
      interest: monthInt,
      remaining,
      notes: notes.join(', '),
    })
  }

  return { totalInt, months, payoffs, schedule, baseMin }
}
