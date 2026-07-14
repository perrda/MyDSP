/** Persist sidebar Favourites / Others layout. */

export interface NavLayout {
  version: 1
  /** Paths pinned to Favourites (order within section). */
  favourites: string[]
  /** Remaining section paths (order within Others). */
  others: string[]
  /** Whether the Others accordion is collapsed. */
  othersCollapsed: boolean
}

const KEY = 'mydsp_nav_layout'
/** Legacy flat order key (migrated on first load). */
const LEGACY_KEY = 'mydsp_nav_order'

/** Sensible default Favourites for a new install. */
export const DEFAULT_FAVOURITE_PATHS = [
  '/',
  '/markets',
  '/crypto',
  '/equities',
  '/spending',
  '/goals',
]

const PINNED_OUT_OF_LIST = new Set(['/settings'])

export function createDefaultNavLayout(allPaths: string[]): NavLayout {
  const usable = allPaths.filter((p) => !PINNED_OUT_OF_LIST.has(p))
  const favSet = new Set(DEFAULT_FAVOURITE_PATHS.filter((p) => usable.includes(p)))
  const favourites = DEFAULT_FAVOURITE_PATHS.filter((p) => favSet.has(p))
  const others = usable.filter((p) => !favSet.has(p))
  return {
    version: 1,
    favourites,
    others,
    othersCollapsed: true,
  }
}

function migrateLegacyOrder(allPaths: string[], saved: string[]): NavLayout {
  const usable = allPaths.filter((p) => !PINNED_OUT_OF_LIST.has(p))
  const ordered = orderNavPaths(usable, saved.filter((p) => !PINNED_OUT_OF_LIST.has(p)))
  const favourites = ordered.slice(0, Math.min(6, ordered.length))
  const others = ordered.slice(favourites.length)
  return {
    version: 1,
    favourites,
    others,
    othersCollapsed: true,
  }
}

/** Merge saved favourites/others with current route list (new routes → Others). */
export function normalizeNavLayout(allPaths: string[], layout: NavLayout): NavLayout {
  const usable = allPaths.filter((p) => !PINNED_OUT_OF_LIST.has(p))
  const usableSet = new Set(usable)
  const seen = new Set<string>()

  const favourites: string[] = []
  for (const p of layout.favourites) {
    if (usableSet.has(p) && !seen.has(p)) {
      favourites.push(p)
      seen.add(p)
    }
  }

  const others: string[] = []
  for (const p of layout.others) {
    if (usableSet.has(p) && !seen.has(p)) {
      others.push(p)
      seen.add(p)
    }
  }
  for (const p of usable) {
    if (!seen.has(p)) others.push(p)
  }

  return {
    version: 1,
    favourites,
    others,
    othersCollapsed: Boolean(layout.othersCollapsed),
  }
}

export function loadNavLayout(allPaths: string[]): NavLayout {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NavLayout>
      if (
        parsed &&
        parsed.version === 1 &&
        Array.isArray(parsed.favourites) &&
        Array.isArray(parsed.others)
      ) {
        return normalizeNavLayout(allPaths, {
          version: 1,
          favourites: parsed.favourites.filter((p): p is string => typeof p === 'string'),
          others: parsed.others.filter((p): p is string => typeof p === 'string'),
          othersCollapsed: Boolean(parsed.othersCollapsed),
        })
      }
    }

    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown
      if (Array.isArray(parsed)) {
        const paths = parsed.filter((p): p is string => typeof p === 'string')
        const migrated = migrateLegacyOrder(allPaths, paths)
        saveNavLayout(migrated)
        return normalizeNavLayout(allPaths, migrated)
      }
    }
  } catch {
    /* fall through */
  }
  return createDefaultNavLayout(allPaths)
}

export function saveNavLayout(layout: NavLayout): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout))
    window.dispatchEvent(new Event('mydsp-nav-order'))
  } catch {
    /* ignore */
  }
}

export function resetNavOrder(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_KEY)
    window.dispatchEvent(new Event('mydsp-nav-order'))
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer loadNavLayout — kept for callers that only need a flat path list. */
export function loadNavOrder(defaultPaths: string[]): string[] {
  const layout = loadNavLayout(defaultPaths)
  return [...layout.favourites, ...layout.others, '/settings'].filter(
    (p, i, arr) => arr.indexOf(p) === i && defaultPaths.includes(p),
  )
}

export function saveNavOrder(paths: string[]): void {
  const usable = paths.filter((p) => !PINNED_OUT_OF_LIST.has(p))
  const favourites = usable.slice(0, Math.min(6, usable.length))
  const others = usable.slice(favourites.length)
  saveNavLayout({
    version: 1,
    favourites,
    others,
    othersCollapsed: true,
  })
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
