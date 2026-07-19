/** Getting-started checklist dismissed — syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_getting_started_dismissed'
const META_KEY = 'mydsp_getting_started_dismissed_meta_v1'

export type GettingStartedDismissedBackup = {
  dismissed: boolean
  updatedAt: string
}

export function loadGettingStartedDismissedPref(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveGettingStartedDismissedPref(
  dismissed: boolean,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const updatedAt = new Date().toISOString()
  try {
    if (dismissed) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ dismissed: Boolean(dismissed), updatedAt }))
    }
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportGettingStartedDismissedForBackup(): GettingStartedDismissedBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as GettingStartedDismissedBackup
      if (parsed && typeof parsed.dismissed === 'boolean') {
        return {
          dismissed: parsed.dismissed,
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    if (localStorage.getItem(KEY) == null) return null
    return {
      dismissed: loadGettingStartedDismissedPref(),
      updatedAt: new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function importGettingStartedDismissedFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as GettingStartedDismissedBackup
  if (typeof remote.dismissed !== 'boolean') return
  const local = exportGettingStartedDismissedForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    if (remote.dismissed) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        dismissed: remote.dismissed,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
