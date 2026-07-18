/** News tag filter — syncs via fullArchive (LWW by updatedAt). */

export const NEWS_FILTER_KEY = 'mydsp_news_filter_tag_v1'
export const NEWS_FILTER_META_KEY = 'mydsp_news_filter_tag_meta_v1'

export type NewsFilterBackup = {
  filterTag: string
  updatedAt: string
}

export function loadNewsFilterTag(): string {
  try {
    const raw = localStorage.getItem(NEWS_FILTER_KEY)
    if (typeof raw === 'string' && raw.trim()) return raw
  } catch {
    /* ignore */
  }
  return 'all'
}

export function saveNewsFilterTag(
  filterTag: string,
  opts?: { markDirty?: boolean },
): void {
  const tag = typeof filterTag === 'string' && filterTag.trim() ? filterTag : 'all'
  const next: NewsFilterBackup = {
    filterTag: tag,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(NEWS_FILTER_KEY, tag)
    localStorage.setItem(NEWS_FILTER_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportNewsFilterForBackup(): NewsFilterBackup | null {
  try {
    const metaRaw = localStorage.getItem(NEWS_FILTER_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as NewsFilterBackup
      if (typeof parsed.filterTag === 'string') {
        return {
          filterTag: parsed.filterTag,
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    return { filterTag: loadNewsFilterTag(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importNewsFilterFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as NewsFilterBackup
  if (typeof remote.filterTag !== 'string') return
  const local = exportNewsFilterForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(NEWS_FILTER_KEY, remote.filterTag)
    localStorage.setItem(
      NEWS_FILTER_META_KEY,
      JSON.stringify({
        filterTag: remote.filterTag,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
