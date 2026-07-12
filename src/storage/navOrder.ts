/** Persist sidebar nav path order. */

const KEY = 'mydsp_nav_order'

export function loadNavOrder(defaultPaths: string[]): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultPaths
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaultPaths
    const paths = parsed.filter((p): p is string => typeof p === 'string')
    return orderNavPaths(defaultPaths, paths)
  } catch {
    return defaultPaths
  }
}

export function saveNavOrder(paths: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(paths))
  } catch {
    /* ignore */
  }
}

export function resetNavOrder(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function orderNavPaths(defaults: string[], saved: string[]): string[] {
  const set = new Set(defaults)
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const p of saved) {
    if (set.has(p) && !seen.has(p)) {
      ordered.push(p)
      seen.add(p)
    }
  }
  for (const p of defaults) {
    if (!seen.has(p)) ordered.push(p)
  }
  return ordered
}
