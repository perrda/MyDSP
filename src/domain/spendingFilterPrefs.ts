/** Spending filter prefs (query + category) — syncs via fullArchive (LWW by updatedAt). */

export const SPENDING_FILTERS_KEY = 'mydsp_spend_filters'
export const SPENDING_FILTERS_META_KEY = 'mydsp_spend_filters_meta_v1'

export type SpendingFiltersBackup = {
  query: string
  category: string
  updatedAt: string
}

export function loadSpendingFilters(): { query: string; category: string } {
  try {
    const raw = localStorage.getItem(SPENDING_FILTERS_KEY)
    if (!raw) return { query: '', category: 'All' }
    const parsed = JSON.parse(raw) as { query?: string; category?: string }
    return {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      category: typeof parsed.category === 'string' ? parsed.category : 'All',
    }
  } catch {
    return { query: '', category: 'All' }
  }
}

export function saveSpendingFilters(
  filters: { query: string; category: string },
  opts?: { markDirty?: boolean },
): void {
  const next: SpendingFiltersBackup = {
    query: typeof filters.query === 'string' ? filters.query : '',
    category: typeof filters.category === 'string' ? filters.category : 'All',
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(
      SPENDING_FILTERS_KEY,
      JSON.stringify({ query: next.query, category: next.category }),
    )
    localStorage.setItem(SPENDING_FILTERS_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportSpendingFiltersForBackup(): SpendingFiltersBackup | null {
  try {
    const metaRaw = localStorage.getItem(SPENDING_FILTERS_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as SpendingFiltersBackup
      return {
        query: typeof parsed.query === 'string' ? parsed.query : '',
        category: typeof parsed.category === 'string' ? parsed.category : 'All',
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    const loaded = loadSpendingFilters()
    return { ...loaded, updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importSpendingFiltersFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as SpendingFiltersBackup
  const local = exportSpendingFiltersForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const next: SpendingFiltersBackup = {
    query: typeof remote.query === 'string' ? remote.query : '',
    category: typeof remote.category === 'string' ? remote.category : 'All',
    updatedAt: remote.updatedAt || new Date().toISOString(),
  }
  try {
    localStorage.setItem(
      SPENDING_FILTERS_KEY,
      JSON.stringify({ query: next.query, category: next.category }),
    )
    localStorage.setItem(SPENDING_FILTERS_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
