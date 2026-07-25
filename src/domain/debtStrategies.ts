import type { CreditCard, Loan } from './types'

export type PaydownStrategy = 'snowball' | 'avalanche'

export interface DebtStrategyDebt {
  id: string
  name: string
  balance: number
  apr: number
  minPay: number
}

export interface DebtPaydownEstimate {
  strategy: PaydownStrategy
  months: number | null
  totalInterest: number
  startingDebt: number
  monthlyPayment: number
}

export interface DebtStrategyComparison {
  snowball: DebtPaydownEstimate
  avalanche: DebtPaydownEstimate
  winner: PaydownStrategy | 'tie' | 'none'
}

function activeDebts(debts: DebtStrategyDebt[]): DebtStrategyDebt[] {
  return debts
    .filter((d) => d.balance > 0 && d.minPay > 0)
    .map((d) => ({
      ...d,
      balance: Math.max(0, d.balance),
      apr: Math.max(0, d.apr),
      minPay: Math.max(0, d.minPay),
    }))
}

export function debtsFromLiabilities(
  creditCards: CreditCard[],
  loans: Loan[],
): DebtStrategyDebt[] {
  return [
    ...creditCards
      .filter((c) => c.includeInPortfolio !== false)
      .map((c) => ({
        id: `card-${c.id}`,
        name: c.name,
        balance: c.balance,
        apr: c.apr,
        minPay: c.minPay,
      })),
    ...loans
      .filter((l) => l.includeInPortfolio !== false)
      .map((l) => ({
        id: `loan-${l.id}`,
        name: l.name,
        balance: l.balance,
        apr: l.apr,
        minPay: l.minPay,
      })),
  ]
}

function sortForStrategy(strategy: PaydownStrategy, debts: DebtStrategyDebt[]): DebtStrategyDebt[] {
  const list = [...debts]
  if (strategy === 'snowball') {
    return list.sort((a, b) => a.balance - b.balance || b.apr - a.apr)
  }
  return list.sort((a, b) => b.apr - a.apr || a.balance - b.balance)
}

export function estimateDebtPaydown(
  input: DebtStrategyDebt[],
  strategy: PaydownStrategy,
  maxMonths = 600,
): DebtPaydownEstimate {
  const debts = activeDebts(input)
  const startingDebt = debts.reduce((sum, d) => sum + d.balance, 0)
  const monthlyPayment = debts.reduce((sum, d) => sum + d.minPay, 0)
  if (startingDebt <= 0) {
    return { strategy, months: 0, totalInterest: 0, startingDebt: 0, monthlyPayment: 0 }
  }
  if (monthlyPayment <= 0) {
    return { strategy, months: null, totalInterest: 0, startingDebt, monthlyPayment: 0 }
  }

  let months = 0
  let totalInterest = 0
  let previousRemaining = startingDebt
  let stalledMonths = 0

  while (debts.some((d) => d.balance > 0.01) && months < maxMonths) {
    months += 1

    for (const debt of debts) {
      if (debt.balance <= 0) continue
      const interest = (debt.balance * (debt.apr / 100)) / 12
      debt.balance += interest
      totalInterest += interest
    }

    const ordered = sortForStrategy(
      strategy,
      debts.filter((d) => d.balance > 0.01),
    )
    const target = ordered[0]
    let paid = 0

    for (const debt of debts) {
      if (debt.balance <= 0.01 || debt.id === target?.id) continue
      const payment = Math.min(debt.minPay, debt.balance, monthlyPayment - paid)
      debt.balance -= payment
      paid += payment
    }

    let available = Math.max(0, monthlyPayment - paid)
    for (const debt of ordered) {
      if (available <= 0 || debt.balance <= 0.01) continue
      const payment = Math.min(available, debt.balance)
      debt.balance -= payment
      available -= payment
    }

    for (const debt of debts) {
      if (debt.balance <= 0.01) debt.balance = 0
    }

    const remaining = debts.reduce((sum, d) => sum + d.balance, 0)
    if (remaining >= previousRemaining - 0.01) {
      stalledMonths += 1
      if (stalledMonths >= 3) {
        return { strategy, months: null, totalInterest, startingDebt, monthlyPayment }
      }
    } else {
      stalledMonths = 0
    }
    previousRemaining = remaining
  }

  return {
    strategy,
    months: debts.some((d) => d.balance > 0.01) ? null : months,
    totalInterest,
    startingDebt,
    monthlyPayment,
  }
}

export function compareDebtStrategies(
  creditCards: CreditCard[],
  loans: Loan[],
): DebtStrategyComparison {
  const debts = debtsFromLiabilities(creditCards, loans)
  const snowball = estimateDebtPaydown(debts, 'snowball')
  const avalanche = estimateDebtPaydown(debts, 'avalanche')

  let winner: DebtStrategyComparison['winner'] = 'none'
  if (snowball.months != null && avalanche.months != null) {
    if (snowball.months === avalanche.months) {
      const interestDelta = Math.abs(snowball.totalInterest - avalanche.totalInterest)
      winner =
        interestDelta < 0.01
          ? 'tie'
          : snowball.totalInterest < avalanche.totalInterest
            ? 'snowball'
            : 'avalanche'
    } else {
      winner = snowball.months < avalanche.months ? 'snowball' : 'avalanche'
    }
  } else if (snowball.months != null) {
    winner = 'snowball'
  } else if (avalanche.months != null) {
    winner = 'avalanche'
  }

  return { snowball, avalanche, winner }
}
