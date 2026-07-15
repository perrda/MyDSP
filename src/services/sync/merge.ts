/** Merge helpers for encrypted sync pull. */

import type { HistoryPoint, PortfolioData } from '../../domain/types'
import type { TodoItem, TodoList } from '../../domain/todo-types'
import { HISTORY_RETENTION, normalizeHistoryDate } from '../../domain/history'

function pickById<T extends { id: number }>(a: T[], b: T[]): T[] {
  const map = new Map<number, T>()
  for (const x of a) map.set(x.id, x)
  for (const x of b) {
    if (!map.has(x.id)) map.set(x.id, x)
  }
  return [...map.values()]
}

function normListName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Union todo lists/items by id, collapsing same-name lists created independently
 * on two devices (different ids) so items land on one list.
 */
export function mergeTodoListsAndItems(
  localLists: TodoList[],
  remoteLists: TodoList[],
  localItems: TodoItem[],
  remoteItems: TodoItem[],
): { todoLists: TodoList[]; todoItems: TodoItem[] } {
  const lists: TodoList[] = [...localLists]
  const nameToId = new Map<string, number>()
  for (const l of lists) nameToId.set(normListName(l.name), l.id)

  const idRemap = new Map<number, number>()
  for (const rl of remoteLists) {
    if (lists.some((l) => l.id === rl.id)) continue
    const key = normListName(rl.name)
    const existing = nameToId.get(key)
    if (existing != null) {
      idRemap.set(rl.id, existing)
    } else {
      lists.push(rl)
      nameToId.set(key, rl.id)
    }
  }

  const items = pickById(localItems, remoteItems).map((item) => {
    const mapped = idRemap.get(item.listId)
    return mapped != null && mapped !== item.listId ? { ...item, listId: mapped } : item
  })

  return { todoLists: lists, todoItems: items }
}

function mergeHistory(a: HistoryPoint[], b: HistoryPoint[]): HistoryPoint[] {
  const map = new Map<string, HistoryPoint>()
  for (const h of [...a, ...b]) {
    const day = normalizeHistoryDate(h?.date)
    if (!day) continue
    const k = h.at ? `${day}|${h.at}` : day
    const prev = map.get(k)
    map.set(k, prev ? { ...prev, ...h, date: day } : { ...h, date: day })
  }
  return [...map.values()]
    .sort((x, y) => {
      const ka = x.at ?? `${x.date}T23:59:59.000Z`
      const kb = y.at ?? `${y.date}T23:59:59.000Z`
      return ka.localeCompare(kb)
    })
    .slice(-HISTORY_RETENTION)
}

export function mergePortfolio(local: PortfolioData, remote: PortfolioData): PortfolioData {
  const todos = mergeTodoListsAndItems(
    local.todoLists ?? [],
    remote.todoLists ?? [],
    local.todoItems ?? [],
    remote.todoItems ?? [],
  )
  return {
    ...local,
    crypto: pickById(local.crypto, remote.crypto),
    equities: pickById(local.equities, remote.equities),
    creditCards: pickById(local.creditCards, remote.creditCards),
    loans: pickById(local.loans, remote.loans),
    goals: pickById(local.goals, remote.goals),
    journal: pickById(local.journal, remote.journal),
    spending: pickById(local.spending, remote.spending),
    recurringTransactions: pickById(local.recurringTransactions, remote.recurringTransactions),
    trips: pickById(local.trips, remote.trips),
    merchantRules: pickById(local.merchantRules, remote.merchantRules),
    disposals: pickById(local.disposals, remote.disposals),
    documents: pickById(local.documents, remote.documents),
    customCategories: [...new Set([...local.customCategories, ...remote.customCategories])],
    history: mergeHistory(local.history, remote.history),
    staking: {
      pool: remote.staking?.pool?.name ? remote.staking.pool : local.staking?.pool,
      rewards: [
        ...new Map(
          [...(local.staking?.rewards ?? []), ...(remote.staking?.rewards ?? [])].map((r) => [
            `${r.epoch}-${r.date}-${r.amount}`,
            r,
          ]),
        ).values(),
      ],
    },
    family: {
      settings: remote.family?.settings ?? local.family?.settings,
      members: (() => {
        const map = new Map((local.family?.members ?? []).map((m) => [m.id, m]))
        for (const m of remote.family?.members ?? []) {
          if (!map.has(m.id)) map.set(m.id, m)
        }
        return [...map.values()]
      })(),
    },
    budgetGoals: { ...local.budgetGoals, ...remote.budgetGoals },
    paidOff: [...local.paidOff, ...remote.paidOff.filter((p) => !local.paidOff.some((x) => x.name === p.name))],
    todoLists: todos.todoLists,
    todoItems: todos.todoItems,
    jobApplications: pickById(local.jobApplications ?? [], remote.jobApplications ?? []),
    // Prefer remote scalars when present so FIRE / income edits sync across devices
    fireInputs: remote.fireInputs ?? local.fireInputs,
    monthlyIncome:
      typeof remote.monthlyIncome === 'number' ? remote.monthlyIncome : local.monthlyIncome,
    monthlyExpenses:
      typeof remote.monthlyExpenses === 'number' ? remote.monthlyExpenses : local.monthlyExpenses,
    targetAllocations: remote.targetAllocations ?? local.targetAllocations,
    splitSettings: remote.splitSettings ?? local.splitSettings,
    settings: {
      ...local.settings,
      ...remote.settings,
      currency: local.settings.currency,
      privacy: local.settings.privacy,
    },
    extras: { ...local.extras, ...remote.extras },
  }
}
