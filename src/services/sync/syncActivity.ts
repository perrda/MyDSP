/** Ring-buffer of recent sync activity for Settings + Overview. */

export interface SyncActivityEntry {
  id: string
  at: string
  source: 'pull' | 'push' | 'import' | 'auto'
  message: string
  merged?: number
  conflicts?: number
  deviceHint?: string
}

const KEY = 'mydsp_sync_activity_v1'
const MAX = 40

export function loadSyncActivity(): SyncActivityEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is SyncActivityEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as SyncActivityEntry).id === 'string' &&
        typeof (e as SyncActivityEntry).at === 'string' &&
        typeof (e as SyncActivityEntry).message === 'string',
    )
  } catch {
    return []
  }
}

export function appendSyncActivity(
  entry: Omit<SyncActivityEntry, 'id' | 'at'> & { at?: string },
): SyncActivityEntry[] {
  const next: SyncActivityEntry = {
    id: `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: entry.at ?? new Date().toISOString(),
    source: entry.source,
    message: entry.message,
    merged: entry.merged,
    conflicts: entry.conflicts,
    deviceHint: entry.deviceHint,
  }
  const list = [next, ...loadSyncActivity()].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('mydsp-sync-activity'))
  } catch {
    /* ignore */
  }
  return list
}
