/** Liabilities RAG filter — syncs via fullArchive (LWW by updatedAt). */

export const LIABILITIES_RAG_KEY = 'mydsp_liabilities_rag_v1'
export const LIABILITIES_RAG_META_KEY = 'mydsp_liabilities_rag_meta_v1'

export type LiabilitiesRagFilter = 'all' | 'green' | 'amber' | 'red' | 'unset'

const ALLOWED: ReadonlySet<LiabilitiesRagFilter> = new Set([
  'all',
  'green',
  'amber',
  'red',
  'unset',
])

export type LiabilitiesRagBackup = {
  ragFilter: LiabilitiesRagFilter
  updatedAt: string
}

function normalize(raw: string | null | undefined): LiabilitiesRagFilter {
  if (raw && ALLOWED.has(raw as LiabilitiesRagFilter)) return raw as LiabilitiesRagFilter
  return 'all'
}

export function loadLiabilitiesRagFilter(): LiabilitiesRagFilter {
  try {
    return normalize(localStorage.getItem(LIABILITIES_RAG_KEY))
  } catch {
    return 'all'
  }
}

export function saveLiabilitiesRagFilter(
  ragFilter: string,
  opts?: { markDirty?: boolean },
): void {
  const nextFilter = normalize(ragFilter)
  const next: LiabilitiesRagBackup = {
    ragFilter: nextFilter,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(LIABILITIES_RAG_KEY, nextFilter)
    localStorage.setItem(LIABILITIES_RAG_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportLiabilitiesRagForBackup(): LiabilitiesRagBackup | null {
  try {
    const metaRaw = localStorage.getItem(LIABILITIES_RAG_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as LiabilitiesRagBackup
      return {
        ragFilter: normalize(parsed.ragFilter),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { ragFilter: loadLiabilitiesRagFilter(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importLiabilitiesRagFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as LiabilitiesRagBackup
  const local = exportLiabilitiesRagForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const ragFilter = normalize(typeof remote.ragFilter === 'string' ? remote.ragFilter : 'all')
  try {
    localStorage.setItem(LIABILITIES_RAG_KEY, ragFilter)
    localStorage.setItem(
      LIABILITIES_RAG_META_KEY,
      JSON.stringify({
        ragFilter,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
