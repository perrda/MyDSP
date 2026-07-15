/** Persist preferred section opened when MyDSP launches. */

export const DEFAULT_LAUNCH_PATH = '/'

/** Paths the user can pick as on-launch home (must match App routes). */
export const LAUNCH_PATH_OPTIONS: Array<{ path: string; label: string }> = [
  { path: '/', label: 'Overview' },
  { path: '/markets', label: 'Markets' },
  { path: '/todos', label: 'To Do Lists' },
  { path: '/crypto', label: 'Crypto' },
  { path: '/equities', label: 'Equities' },
  { path: '/spending', label: 'Spending' },
  { path: '/goals', label: 'Goals' },
  { path: '/jobs', label: 'Job Tracker' },
  { path: '/news', label: 'News' },
  { path: '/settings', label: 'Settings' },
]

const KEY = 'mydsp_launch_path'
const ALLOWED = new Set(LAUNCH_PATH_OPTIONS.map((o) => o.path))

export function loadLaunchPath(): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && ALLOWED.has(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_LAUNCH_PATH
}

export function saveLaunchPath(path: string): void {
  const next = ALLOWED.has(path) ? path : DEFAULT_LAUNCH_PATH
  try {
    localStorage.setItem(KEY, next)
    window.dispatchEvent(new CustomEvent('mydsp-launch-path'))
  } catch {
    /* ignore */
  }
}

export function isAllowedLaunchPath(path: string): boolean {
  return ALLOWED.has(path)
}
