/** Compare selected portfolio IDs — syncs via fullArchive (LWW by updatedAt). */

export const COMPARE_SELECTED_KEY = 'mydsp_compare_selected_v1'
export const COMPARE_SELECTED_META_KEY = 'mydsp_compare_selected_meta_v1'

export type CompareSelectionBackup = {
  ids: string[]
  updatedAt: string
}

export function loadCompareSelectedIds(validIds: string[]): string[] {
  const valid = new Set(validIds)
  try {
    const raw = localStorage.getItem(COMPARE_SELECTED_KEY)
    if (raw) {
      const ids = JSON.parse(raw) as string[]
      if (Array.isArray(ids)) {
        const filtered = ids.filter((id) => typeof id === 'string' && valid.has(id))
        if (filtered.length > 0) return filtered
      }
    }
  } catch {
    /* ignore */
  }
  return validIds
}

export function saveCompareSelectedIds(
  ids: string[],
  opts?: { markDirty?: boolean },
): void {
  const next: CompareSelectionBackup = {
    ids: ids.filter((id) => typeof id === 'string'),
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(COMPARE_SELECTED_KEY, JSON.stringify(next.ids))
    localStorage.setItem(COMPARE_SELECTED_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportCompareSelectionForBackup(): CompareSelectionBackup | null {
  try {
    const metaRaw = localStorage.getItem(COMPARE_SELECTED_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as CompareSelectionBackup
      if (Array.isArray(parsed.ids)) {
        return {
          ids: parsed.ids.filter((id) => typeof id === 'string'),
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const raw = localStorage.getItem(COMPARE_SELECTED_KEY)
    if (!raw) return null
    const ids = JSON.parse(raw) as string[]
    if (!Array.isArray(ids)) return null
    return {
      ids: ids.filter((id) => typeof id === 'string'),
      updatedAt: new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function importCompareSelectionFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as CompareSelectionBackup
  if (!Array.isArray(remote.ids)) return
  const local = exportCompareSelectionForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    const ids = remote.ids.filter((id) => typeof id === 'string')
    localStorage.setItem(COMPARE_SELECTED_KEY, JSON.stringify(ids))
    localStorage.setItem(
      COMPARE_SELECTED_META_KEY,
      JSON.stringify({
        ids,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
