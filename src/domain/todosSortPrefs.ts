/** Todos sort preference — syncs via fullArchive (LWW by updatedAt). */

import type { TodoSortBy } from './todo-types'

export const TODOS_SORT_KEY = 'mydsp_todos_sort_v1'
export const TODOS_SORT_META_KEY = 'mydsp_todos_sort_meta_v1'

const ALLOWED: ReadonlySet<TodoSortBy> = new Set([
  'order-asc',
  'order-desc',
  'priority-desc',
  'priority-asc',
  'due-date-asc',
  'due-date-desc',
  'created-asc',
  'created-desc',
  'title-asc',
  'title-desc',
])

export type TodosSortBackup = {
  sortBy: TodoSortBy
  updatedAt: string
}

function normalize(raw: string | null | undefined): TodoSortBy {
  if (raw && ALLOWED.has(raw as TodoSortBy)) return raw as TodoSortBy
  return 'order-asc'
}

export function loadTodosSort(): TodoSortBy {
  try {
    return normalize(localStorage.getItem(TODOS_SORT_KEY))
  } catch {
    return 'order-asc'
  }
}

export function saveTodosSort(
  sortBy: TodoSortBy,
  opts?: { markDirty?: boolean },
): void {
  const nextSort = normalize(sortBy)
  const next: TodosSortBackup = {
    sortBy: nextSort,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(TODOS_SORT_KEY, nextSort)
    localStorage.setItem(TODOS_SORT_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportTodosSortForBackup(): TodosSortBackup | null {
  try {
    const metaRaw = localStorage.getItem(TODOS_SORT_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as TodosSortBackup
      return {
        sortBy: normalize(parsed.sortBy),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { sortBy: loadTodosSort(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importTodosSortFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as TodosSortBackup
  const local = exportTodosSortForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const sortBy = normalize(typeof remote.sortBy === 'string' ? remote.sortBy : 'order-asc')
  try {
    localStorage.setItem(TODOS_SORT_KEY, sortBy)
    localStorage.setItem(
      TODOS_SORT_META_KEY,
      JSON.stringify({
        sortBy,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
