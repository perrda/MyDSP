/** Today “next action” stack: up to 3 cards — todo / bill / interview / follow-up / top mover. */

import { getNextInterview, needsFollowUp } from './jobs'
import type { JobApplication } from './job-types'
import { dueWithinDays } from './recurringDueStrip'
import { isDueToday, isOverdue } from './todos'
import type { RecurringTransaction } from './types'
import type { TodoItem } from './todo-types'

export type NextActionKind = 'todo' | 'bill' | 'interview' | 'followup' | 'mover'

export interface NextActionTodo {
  kind: 'todo'
  todo: TodoItem
  label: string
}

export interface NextActionBill {
  kind: 'bill'
  bill: RecurringTransaction
}

export interface NextActionInterview {
  kind: 'interview'
  jobId: number
  companyName: string
  jobTitle: string
  scheduledDate: string
}

export interface NextActionFollowUp {
  kind: 'followup'
  jobId: number
  companyName: string
  jobTitle: string
  label: string
}

export interface NextActionMover {
  kind: 'mover'
  symbol: string
  changePct: number
}

export type NextActionCard =
  | NextActionTodo
  | NextActionBill
  | NextActionInterview
  | NextActionFollowUp
  | NextActionMover

export interface MoverInput {
  symbol: string
  changePct: number
}

/**
 * Build a compact next-action stack (max 3): next incomplete todo,
 * soonest bill due within 7 days, soonest pending interview within 7 days,
 * and top absolute % mover.
 */
export function buildNextActionStack(input: {
  todoItems?: TodoItem[]
  recurringTransactions?: RecurringTransaction[]
  jobApplications?: JobApplication[]
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
  const dueTodayOrOverdue = open.filter((t) => isOverdue(t) || isDueToday(t))
  const rank = (t: (typeof open)[number]) => {
    const p = t.priority === 'high' ? 0 : t.priority === 'medium' ? 1 : 2
    return p
  }
  dueTodayOrOverdue.sort((a, b) => rank(a) - rank(b))
  const dueFirst = dueTodayOrOverdue[0] ?? open[0] ?? null
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

  const interviewCandidates = (input.jobApplications ?? [])
    .map((app) => {
      const next = getNextInterview(app)
      if (!next) return null
      const when = Date.parse(next.scheduledDate)
      if (!Number.isFinite(when)) return null
      const days = Math.floor((when - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days < 0 || days > 7) return null
      return {
        kind: 'interview' as const,
        jobId: app.id,
        companyName: app.companyName,
        jobTitle: app.jobTitle,
        scheduledDate: next.scheduledDate,
      }
    })
    .filter((x): x is NextActionInterview => x != null)
    .sort(
      (a, b) => Date.parse(a.scheduledDate) - Date.parse(b.scheduledDate),
    )
  if (interviewCandidates[0]) {
    out.push(interviewCandidates[0])
  } else {
    // When no interview is due, surface a stale application that needs follow-up.
    const followUps = (input.jobApplications ?? [])
      .filter((app) => needsFollowUp(app))
      .sort((a, b) => {
        const aAt = Date.parse(a.appliedDate || a.updatedAt || '') || 0
        const bAt = Date.parse(b.appliedDate || b.updatedAt || '') || 0
        return aAt - bAt
      })
    const first = followUps[0]
    if (first) {
      out.push({
        kind: 'followup',
        jobId: first.id,
        companyName: first.companyName,
        jobTitle: first.jobTitle,
        label: 'Needs follow-up',
      })
    }
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
