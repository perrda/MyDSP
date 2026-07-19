/** Journal asset filter — syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_journal_filter_v1'
const META_KEY = 'mydsp_journal_filter_meta_v1'

export type JournalFilterBackup = {
  asset: string
  updatedAt: string
}

export function loadJournalFilterPref(): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (typeof raw === 'string' && raw.trim()) return raw
  } catch {
    /* ignore */
  }
  return 'All'
}

export function saveJournalFilterPref(
  asset: string,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const next = typeof asset === 'string' && asset.trim() ? asset.trim() : 'All'
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, next)
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ asset: next, updatedAt }))
    }
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportJournalFilterForBackup(): JournalFilterBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as JournalFilterBackup
      if (typeof parsed.asset === 'string') {
        return {
          asset: parsed.asset.trim() || 'All',
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    if (localStorage.getItem(KEY) == null) return null
    return { asset: loadJournalFilterPref(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importJournalFilterFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as JournalFilterBackup
  if (typeof remote.asset !== 'string') return
  const local = exportJournalFilterForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const asset = remote.asset.trim() || 'All'
  try {
    localStorage.setItem(KEY, asset)
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        asset,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
