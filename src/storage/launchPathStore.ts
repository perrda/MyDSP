/** Persist preferred section opened when MyDSP launches. Syncs via fullArchive (LWW). */

export const DEFAULT_LAUNCH_PATH = '/'

/** Paths the user can pick as on-launch home (must match App routes). */
export const LAUNCH_PATH_OPTIONS: Array<{ path: string; label: string }> = [
  { path: '/', label: 'Overview' },
  { path: '/markets', label: 'Markets' },
  { path: '/todos', label: "To Do's" },
  { path: '/crypto', label: 'Crypto' },
  { path: '/equities', label: 'Equities' },
  { path: '/spending', label: 'Spending' },
  { path: '/goals', label: 'Goals' },
  { path: '/jobs', label: 'Job Tracker' },
  { path: '/news', label: 'News' },
  { path: '/settings', label: 'Settings' },
]

const KEY = 'mydsp_launch_path'
const META_KEY = 'mydsp_launch_path_meta_v1'
const ALLOWED = new Set(LAUNCH_PATH_OPTIONS.map((o) => o.path))

export type LaunchPathBackup = {
  path: string
  updatedAt: string
}

export function loadLaunchPath(): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && ALLOWED.has(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_LAUNCH_PATH
}

export function saveLaunchPath(path: string, opts?: { markDirty?: boolean; fromSync?: boolean }): void {
  const next = ALLOWED.has(path) ? path : DEFAULT_LAUNCH_PATH
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, next)
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ path: next, updatedAt }))
    }
    window.dispatchEvent(new CustomEvent('mydsp-launch-path'))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function isAllowedLaunchPath(path: string): boolean {
  return ALLOWED.has(path)
}

export function exportLaunchPathForBackup(): LaunchPathBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as LaunchPathBackup
      if (typeof parsed.path === 'string' && ALLOWED.has(parsed.path)) {
        return {
          path: parsed.path,
          updatedAt:
            typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
      }
    }
    const path = loadLaunchPath()
    if (path === DEFAULT_LAUNCH_PATH && !localStorage.getItem(KEY)) return null
    return { path, updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importLaunchPathFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as LaunchPathBackup
  if (typeof remote.path !== 'string' || !ALLOWED.has(remote.path)) return
  const local = exportLaunchPathForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(KEY, remote.path)
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        path: remote.path,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
    window.dispatchEvent(new CustomEvent('mydsp-launch-path'))
  } catch {
    /* ignore */
  }
}
