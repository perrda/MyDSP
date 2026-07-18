/** Recurring sort preference — syncs via fullArchive (LWW by updatedAt). */

import {
  RECURRING_SORT_OPTIONS,
  type RecurringSort,
} from './recurringHelpers'

export const RECURRING_SORT_KEY = 'mydsp_recurring_sort_v1'
export const RECURRING_SORT_META_KEY = 'mydsp_recurring_sort_meta_v1'

export type RecurringSortBackup = {
  sort: RecurringSort
  updatedAt: string
}

function isRecurringSort(v: unknown): v is RecurringSort {
  return typeof v === 'string' && RECURRING_SORT_OPTIONS.some((o) => o.id === v)
}

export function loadRecurringSort(): RecurringSort {
  try {
    const raw = localStorage.getItem(RECURRING_SORT_KEY)
    if (isRecurringSort(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'due-asc'
}

export function saveRecurringSort(
  sort: RecurringSort,
  opts?: { markDirty?: boolean },
): void {
  if (!isRecurringSort(sort)) return
  const next: RecurringSortBackup = {
    sort,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(RECURRING_SORT_KEY, sort)
    localStorage.setItem(RECURRING_SORT_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportRecurringSortForBackup(): RecurringSortBackup | null {
  try {
    const metaRaw = localStorage.getItem(RECURRING_SORT_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as RecurringSortBackup
      if (isRecurringSort(parsed.sort)) {
        return {
          sort: parsed.sort,
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const sort = loadRecurringSort()
    return { sort, updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importRecurringSortFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as RecurringSortBackup
  if (!isRecurringSort(remote.sort)) return
  const local = exportRecurringSortForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(RECURRING_SORT_KEY, remote.sort)
    localStorage.setItem(
      RECURRING_SORT_META_KEY,
      JSON.stringify({
        sort: remote.sort,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
