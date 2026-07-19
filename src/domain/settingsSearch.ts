/** Fuzzy Settings section search + recent jump chips (localStorage). */

export const SETTINGS_RECENT_KEY = 'mydsp_settings_recent_jumps_v1'
export const SETTINGS_RECENT_META_KEY = 'mydsp_settings_recent_jumps_meta_v1'
export const SETTINGS_RECENT_MAX = 5

export type SettingsSectionId = string

export type SettingsRecentJumpsBackup = {
  ids: string[]
  updatedAt: string
}

/** Score a settings section for a query: startsWith > includes on id/keywords. */
export function scoreSettingsSection(
  query: string,
  id: string,
  keywords: string,
): number {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return 0

  const idLower = id.toLowerCase()
  const hay = `${idLower} ${keywords.toLowerCase()}`
  const tokens = hay.split(/\s+/).filter(Boolean)

  let best = 0

  if (idLower === q) best = Math.max(best, 1)
  if (idLower.startsWith(q)) best = Math.max(best, 0.95)
  if (idLower.includes(q)) best = Math.max(best, 0.8)

  for (const token of tokens) {
    if (token === q) best = Math.max(best, 0.98)
    if (token.startsWith(q)) best = Math.max(best, 0.9)
    if (token.includes(q)) best = Math.max(best, 0.75)
    if (q.includes(token) && token.length >= 3) best = Math.max(best, 0.55)
  }

  if (hay.includes(q)) best = Math.max(best, 0.7)

  return best
}

export function rankSettingsSections<T extends string>(
  query: string,
  ids: readonly T[],
  keywords: Record<T, string>,
  minScore = 0.55,
): Array<{ id: T; score: number }> {
  const ranked = ids
    .map((id) => ({
      id,
      score: scoreSettingsSection(query, id, keywords[id] ?? ''),
    }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return ranked
}

export function loadRecentSettingsJumps(
  storage: Storage = localStorage,
): string[] {
  try {
    const raw = storage.getItem(SETTINGS_RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, SETTINGS_RECENT_MAX)
  } catch {
    return []
  }
}

export function saveRecentSettingsJumps(
  ids: string[],
  storage: Storage = localStorage,
  opts?: { markDirty?: boolean; fromSync?: boolean; updatedAt?: string },
): void {
  const nextIds = ids.slice(0, SETTINGS_RECENT_MAX)
  const updatedAt = opts?.updatedAt || new Date().toISOString()
  try {
    storage.setItem(SETTINGS_RECENT_KEY, JSON.stringify(nextIds))
    if (!opts?.fromSync) {
      storage.setItem(
        SETTINGS_RECENT_META_KEY,
        JSON.stringify({ ids: nextIds, updatedAt }),
      )
    } else {
      storage.setItem(
        SETTINGS_RECENT_META_KEY,
        JSON.stringify({ ids: nextIds, updatedAt }),
      )
    }
  } catch {
    /* quota / private mode */
  }
  if (opts?.markDirty !== false && !opts?.fromSync && storage === localStorage) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

/** Push a section id to the front of recent jumps (deduped). */
export function recordSettingsJump(
  id: string,
  storage: Storage = localStorage,
): string[] {
  const prev = loadRecentSettingsJumps(storage).filter((x) => x !== id)
  const next = [id, ...prev].slice(0, SETTINGS_RECENT_MAX)
  saveRecentSettingsJumps(next, storage)
  return next
}

export function exportSettingsRecentJumpsForBackup(): SettingsRecentJumpsBackup | null {
  try {
    const metaRaw = localStorage.getItem(SETTINGS_RECENT_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as SettingsRecentJumpsBackup
      if (Array.isArray(parsed.ids)) {
        return {
          ids: parsed.ids.filter((x): x is string => typeof x === 'string').slice(0, SETTINGS_RECENT_MAX),
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const ids = loadRecentSettingsJumps()
    if (ids.length === 0) return null
    return { ids, updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importSettingsRecentJumpsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as SettingsRecentJumpsBackup
  if (!Array.isArray(remote.ids)) return
  const local = exportSettingsRecentJumpsForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  saveRecentSettingsJumps(
    remote.ids.filter((x): x is string => typeof x === 'string'),
    localStorage,
    {
      fromSync: true,
      markDirty: false,
      updatedAt: remote.updatedAt || new Date().toISOString(),
    },
  )
}

/** Human label for a settings section id (chip text). */
export function settingsSectionLabel(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
