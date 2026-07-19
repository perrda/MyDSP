/** Today “next action” stack: up to 3 cards — todo / bill / interview / follow-up / goal / top mover. */

import { getNextInterview, needsFollowUp } from './jobs'
import type { JobApplication } from './job-types'
import { dueWithinDays } from './recurringDueStrip'
import { isDueToday, isOverdue } from './todos'
import type { Goal, RecurringTransaction } from './types'
import type { TodoItem } from './todo-types'

export type NextActionKind = 'todo' | 'bill' | 'interview' | 'followup' | 'goal' | 'mover'

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

export interface NextActionGoal {
  kind: 'goal'
  goalId: number
  name: string
  deadline: string
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
  | NextActionGoal
  | NextActionMover

export interface MoverInput {
  symbol: string
  changePct: number
}

function pickSoonestGoal(goals: Goal[] | undefined, now: Date): Goal | null {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const startMs = start.getTime()
  let upcoming: Goal | null = null
  let upcomingAt = Infinity
  let fallback: Goal | null = null
  let fallbackAt = Infinity
  for (const g of goals ?? []) {
    if (!g.deadline) continue
    const dl = Date.parse(`${g.deadline.slice(0, 10)}T00:00:00`)
    if (!Number.isFinite(dl)) continue
    if (dl >= startMs) {
      if (dl < upcomingAt) {
        upcomingAt = dl
        upcoming = g
      }
    } else if (dl < fallbackAt) {
      fallbackAt = dl
      fallback = g
    }
  }
  return upcoming ?? fallback
}

/**
 * Build a compact next-action stack (max 3): next incomplete todo,
 * soonest bill due within 7 days, soonest pending interview within 7 days,
 * soonest goal when no todo/bill/interview/follow-up, and top absolute % mover.
 */
export function buildNextActionStack(input: {
  todoItems?: TodoItem[]
  recurringTransactions?: RecurringTransaction[]
  jobApplications?: JobApplication[]
  goals?: Goal[]
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

  const hasPrimaryAction = out.some(
    (c) =>
      c.kind === 'todo' ||
      c.kind === 'bill' ||
      c.kind === 'interview' ||
      c.kind === 'followup',
  )
  if (!hasPrimaryAction) {
    const soonest = pickSoonestGoal(input.goals, now)
    if (soonest) {
      out.push({
        kind: 'goal',
        goalId: soonest.id,
        name: soonest.name,
        deadline: soonest.deadline,
        label: 'Goal',
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
