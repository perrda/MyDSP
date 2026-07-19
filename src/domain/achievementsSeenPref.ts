/** Achievements seen ids — syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_achievements_seen'
const META_KEY = 'mydsp_achievements_seen_meta_v1'

export type AchievementsSeenBackup = {
  seen: string[]
  updatedAt: string
}

function normalizeSeen(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const id of raw) {
    if (typeof id === 'string' && id.trim()) out.push(id.trim())
  }
  return out
}

export function loadAchievementsSeenPref(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    return new Set(normalizeSeen(JSON.parse(raw) as unknown))
  } catch {
    return new Set()
  }
}

export function saveAchievementsSeenPref(
  ids: Set<string> | string[],
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const seen = normalizeSeen([...ids])
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, JSON.stringify(seen))
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ seen, updatedAt }))
    }
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportAchievementsSeenForBackup(): AchievementsSeenBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as AchievementsSeenBackup
      if (parsed && Array.isArray(parsed.seen)) {
        return {
          seen: normalizeSeen(parsed.seen),
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return {
      seen: normalizeSeen(JSON.parse(raw) as unknown),
      updatedAt: new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function importAchievementsSeenFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as AchievementsSeenBackup
  if (!Array.isArray(remote.seen)) return
  const local = exportAchievementsSeenForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const seen = normalizeSeen(remote.seen)
  try {
    localStorage.setItem(KEY, JSON.stringify(seen))
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        seen,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
