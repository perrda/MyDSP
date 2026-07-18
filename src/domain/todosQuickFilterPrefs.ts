/** Todos quick-filter (Due today / High priority) — syncs via fullArchive (LWW by updatedAt). */

export const TODOS_QUICK_FILTER_KEY = 'mydsp_todos_quick_filter_v1'
export const TODOS_QUICK_FILTER_META_KEY = 'mydsp_todos_quick_filter_meta_v1'

export type TodosQuickFilterValue = 'today' | 'high-priority' | 'all'

export type TodosQuickFilterBackup = {
  filter: TodosQuickFilterValue
  updatedAt: string
}

function normalize(raw: string | null | undefined): TodosQuickFilterValue {
  if (raw === 'today' || raw === 'high-priority') return raw
  return 'all'
}

export function loadTodosQuickFilter(): TodosQuickFilterValue {
  try {
    return normalize(localStorage.getItem(TODOS_QUICK_FILTER_KEY))
  } catch {
    return 'all'
  }
}

export function saveTodosQuickFilter(
  filter: string,
  opts?: { markDirty?: boolean },
): void {
  const nextFilter = normalize(filter)
  const next: TodosQuickFilterBackup = {
    filter: nextFilter,
    updatedAt: new Date().toISOString(),
  }
  try {
    if (nextFilter === 'today' || nextFilter === 'high-priority') {
      localStorage.setItem(TODOS_QUICK_FILTER_KEY, nextFilter)
    } else {
      localStorage.removeItem(TODOS_QUICK_FILTER_KEY)
    }
    localStorage.setItem(TODOS_QUICK_FILTER_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportTodosQuickFilterForBackup(): TodosQuickFilterBackup | null {
  try {
    const metaRaw = localStorage.getItem(TODOS_QUICK_FILTER_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as TodosQuickFilterBackup
      return {
        filter: normalize(parsed.filter),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { filter: loadTodosQuickFilter(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importTodosQuickFilterFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as TodosQuickFilterBackup
  const local = exportTodosQuickFilterForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const filter = normalize(typeof remote.filter === 'string' ? remote.filter : 'all')
  try {
    if (filter === 'today' || filter === 'high-priority') {
      localStorage.setItem(TODOS_QUICK_FILTER_KEY, filter)
    } else {
      localStorage.removeItem(TODOS_QUICK_FILTER_KEY)
    }
    localStorage.setItem(
      TODOS_QUICK_FILTER_META_KEY,
      JSON.stringify({
        filter,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
