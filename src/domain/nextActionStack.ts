/** Today “next action” stack: up to 3 cards — todo / bill / top mover. */

import { dueWithinDays } from './recurringDueStrip'
import { isDueToday, isOverdue } from './todos'
import type { RecurringTransaction } from './types'
import type { TodoItem } from './todo-types'

export type NextActionKind = 'todo' | 'bill' | 'mover'

export interface NextActionTodo {
  kind: 'todo'
  todo: TodoItem
  label: string
}

export interface NextActionBill {
  kind: 'bill'
  bill: RecurringTransaction
}

export interface NextActionMover {
  kind: 'mover'
  symbol: string
  changePct: number
}

export type NextActionCard = NextActionTodo | NextActionBill | NextActionMover

export interface MoverInput {
  symbol: string
  changePct: number
}

/**
 * Build a compact next-action stack (max 3): next incomplete todo,
 * soonest bill due within 7 days, and top absolute % mover.
 */
export function buildNextActionStack(input: {
  todoItems?: TodoItem[]
  recurringTransactions?: RecurringTransaction[]
  movers?: MoverInput[]
  now?: Date
  max?: number
}): NextActionCard[] {
  const max = input.max ?? 3
  const now = input.now ?? new Date()
  const out: NextActionCard[] = []

  const open = (input.todoItems ?? []).filter(
    (t) => t.status !== 'done' && t.status !== 'archived',
  )
  const dueFirst =
    open.find((t) => isOverdue(t) || isDueToday(t)) ?? open[0] ?? null
  if (dueFirst) {
    const label = isOverdue(dueFirst)
      ? 'Overdue'
      : isDueToday(dueFirst)
        ? 'Due today'
        : 'Next task'
    out.push({ kind: 'todo', todo: dueFirst, label })
  }

  const bill = dueWithinDays(input.recurringTransactions, 7, now)[0] ?? null
  if (bill) {
    out.push({ kind: 'bill', bill })
  }

  const movers = [...(input.movers ?? [])].sort(
    (a, b) => Math.abs(b.changePct) - Math.abs(a.changePct),
  )
  const top = movers[0]
  if (top && Number.isFinite(top.changePct)) {
    out.push({ kind: 'mover', symbol: top.symbol, changePct: top.changePct })
  }

  return out.slice(0, max)
}

/** True when the stack already surfaces a bill — hide the longer bills strip. */
export function stackIncludesBill(cards: NextActionCard[]): boolean {
  return cards.some((c) => c.kind === 'bill')
}
