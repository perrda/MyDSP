/** Liability helpers — RAG, interest, single-debt paydown scenarios. */

import type { CreditCard, Loan, RagStatus } from './types'

export type LiabilityKind = 'card' | 'loan'

export interface LiabilityRef {
  kind: LiabilityKind
  id: number
}

export interface LiabilityDue extends LiabilityRef {
  name: string
  minPay: number
  dueDate: string
  daysUntil: number
}

function ymd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dueDateInMonth(year: number, month: number, dueDay: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(dueDay, lastDay))
}

/** Next occurrence of a liability's monthly due day, including today. */
export function nextLiabilityDueDate(
  liability: Pick<CreditCard | Loan, 'paymentDueDay'>,
  from = new Date(),
): string | null {
  const dueDay = liability.paymentDueDay
  if (!Number.isInteger(dueDay) || dueDay == null || dueDay < 1 || dueDay > 31) return null
  const thisMonth = dueDateInMonth(from.getFullYear(), from.getMonth(), dueDay)
  if (ymd(thisMonth) >= ymd(from)) return ymd(thisMonth)
  return ymd(dueDateInMonth(from.getFullYear(), from.getMonth() + 1, dueDay))
}

/** Cards and loans with a payment due from today through the requested window. */
export function liabilitiesDueWithinDays(
  cards: CreditCard[],
  loans: Loan[],
  days = 30,
  from = new Date(),
): LiabilityDue[] {
  const todayUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const limit = Math.max(0, Math.floor(days))
  const due: LiabilityDue[] = []

  const add = (liability: CreditCard | Loan, kind: LiabilityKind) => {
    const dueDate = nextLiabilityDueDate(liability, from)
    if (!dueDate) return
    const [year, month, day] = dueDate.split('-').map(Number)
    const daysUntil = Math.round(
      (Date.UTC(year!, month! - 1, day!) - todayUtc) / 86_400_000,
    )
    if (daysUntil < 0 || daysUntil > limit) return
    due.push({
      kind,
      id: liability.id,
      name: liability.name,
      minPay: liability.minPay,
      dueDate,
      daysUntil,
    })
  }

  cards.forEach((card) => add(card, 'card'))
  loans.forEach((loan) => add(loan, 'loan'))
  return due.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.name.localeCompare(b.name) ||
      a.id - b.id,
  )
}

export function ragLabel(status: RagStatus | undefined): string {
  if (status === 'red') return 'Critical'
  if (status === 'amber') return 'Watch'
  if (status === 'green') return 'On track'
  return 'Unset'
}

export function ragClass(status: RagStatus | undefined): string {
  if (status === 'red') return 'rag-badge rag-red'
  if (status === 'amber') return 'rag-badge rag-amber'
  if (status === 'green') return 'rag-badge rag-green'
  return 'rag-badge rag-unset'
}

/** Suggest RAG from utilisation / APR heuristics (does not overwrite user choice). */
export function suggestRag(item: CreditCard | Loan, kind: LiabilityKind): RagStatus {
  if (kind === 'card') {
    const card = item as CreditCard
    const util = card.limit > 0 ? card.balance / card.limit : 0
    if (util >= 0.8 || card.apr >= 30) return 'red'
    if (util >= 0.5 || card.apr >= 22) return 'amber'
    return 'green'
  }
  const loan = item as Loan
  const remaining = loan.original > 0 ? loan.balance / loan.original : 1
  if (loan.apr >= 15 || remaining >= 0.9) return 'red'
  if (loan.apr >= 8 || remaining >= 0.6) return 'amber'
  return 'green'
}

export function dailyInterestGbp(balance: number, apr: number): number {
  if (balance <= 0 || apr <= 0) return 0
  return (balance * (apr / 100)) / 365
}

export function monthlyInterestGbp(balance: number, apr: number): number {
  if (balance <= 0 || apr <= 0) return 0
  return (balance * (apr / 100)) / 12
}

export interface SingleDebtScenario {
  months: number
  totalInterest: number
  totalPaid: number
  payoffMonth: number | null
  schedule: { month: number; payment: number; interest: number; principal: number; remaining: number }[]
}

/** Simulate paying one liability with a fixed monthly payment (min or custom). */
export function simulateSingleDebt(
  balance: number,
  apr: number,
  monthlyPayment: number,
  maxMonths = 360,
): SingleDebtScenario {
  let bal = Math.max(0, balance)
  let totalInterest = 0
  let totalPaid = 0
  let months = 0
  let payoffMonth: number | null = null
  const schedule: SingleDebtScenario['schedule'] = []
  const pay = Math.max(0, monthlyPayment)

  if (bal <= 0 || pay <= 0) {
    return { months: 0, totalInterest: 0, totalPaid: 0, payoffMonth: bal <= 0 ? 0 : null, schedule: [] }
  }

  while (bal > 0.01 && months < maxMonths) {
    months++
    const interest = (bal * (apr / 100)) / 12
    bal += interest
    totalInterest += interest
    const payment = Math.min(pay, bal)
    bal -= payment
    totalPaid += payment
    const principal = payment - interest
    schedule.push({
      month: months,
      payment,
      interest,
      principal: Math.max(0, principal),
      remaining: Math.max(0, bal),
    })
    if (bal <= 0.01) {
      bal = 0
      payoffMonth = months
      break
    }
    // Unpayable if interest alone exceeds payment
    if (interest >= pay && months > 1) {
      payoffMonth = null
      break
    }
  }

  return { months, totalInterest, totalPaid, payoffMonth, schedule }
}

/** Portfolio debt impact if this liability balance becomes `newBalance`. */
export function portfolioDebtAfter(
  cards: CreditCard[],
  loans: Loan[],
  kind: LiabilityKind,
  id: number,
  newBalance: number,
): { total: number; delta: number; currentTotal: number } {
  const currentTotal = [...cards, ...loans]
    .filter((i) => i.includeInPortfolio !== false)
    .reduce((s, i) => s + i.balance, 0)

  let total = 0
  for (const c of cards) {
    if (c.includeInPortfolio === false) continue
    total += kind === 'card' && c.id === id ? Math.max(0, newBalance) : c.balance
  }
  for (const l of loans) {
    if (l.includeInPortfolio === false) continue
    total += kind === 'loan' && l.id === id ? Math.max(0, newBalance) : l.balance
  }
  return { total, delta: total - currentTotal, currentTotal }
}

export function nextCommentaryId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}
