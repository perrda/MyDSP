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

export function saveNavLayout(
  layout: NavLayout,
  opts?: { fromSync?: boolean },
): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1 as const,
        favourites: layout.favourites,
        others: layout.others,
        othersCollapsed: Boolean(layout.othersCollapsed),
      }),
    )
    window.dispatchEvent(new Event('mydsp-nav-order'))
  } catch {
    /* ignore */
  }
  if (!opts?.fromSync) {
    void notifyNavLayoutChangedForSync()
  }
}

/** Snapshot for full backup / cloud sync (null if never customized). */
export function exportNavLayoutForBackup(): NavLayout | null {
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
        return {
          version: 1,
          favourites: parsed.favourites.filter((p): p is string => typeof p === 'string'),
          others: parsed.others.filter((p): p is string => typeof p === 'string'),
          othersCollapsed: Boolean(parsed.othersCollapsed),
        }
      }
    }

    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown
      if (Array.isArray(parsed)) {
        const paths = parsed.filter((p): p is string => typeof p === 'string')
        // Migrate into v1 layout so future exports are consistent
        const migrated = migrateLegacyOrder(
          [...new Set([...DEFAULT_FAVOURITE_PATHS, ...paths])],
          paths,
        )
        saveNavLayout(migrated, { fromSync: true })
        return {
          version: 1,
          favourites: [...migrated.favourites],
          others: [...migrated.others],
          othersCollapsed: migrated.othersCollapsed,
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Restore Favourites / Others from backup or cloud fullArchive. */
export function importNavLayoutFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as Partial<NavLayout>
  if (parsed.version !== 1) return
  if (!Array.isArray(parsed.favourites) || !Array.isArray(parsed.others)) return
  const favourites = parsed.favourites.filter((p): p is string => typeof p === 'string')
  const others = parsed.others.filter((p): p is string => typeof p === 'string')
  // Dedupe while preserving order (favourites win if listed in both)
  const seen = new Set<string>()
  const favClean: string[] = []
  for (const p of favourites) {
    if (PINNED_OUT_OF_LIST.has(p) || seen.has(p)) continue
    favClean.push(p)
    seen.add(p)
  }
  const othersClean: string[] = []
  for (const p of others) {
    if (PINNED_OUT_OF_LIST.has(p) || seen.has(p)) continue
    othersClean.push(p)
    seen.add(p)
  }
  saveNavLayout(
    {
      version: 1,
      favourites: favClean,
      others: othersClean,
      othersCollapsed: Boolean(parsed.othersCollapsed),
    },
    { fromSync: true },
  )
}

async function notifyNavLayoutChangedForSync(): Promise<void> {
  const { markWorkspaceChangedForSync } = await import('../services/sync/workspaceDirty')
  await markWorkspaceChangedForSync()
}

export function resetNavOrder(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
  // Persist defaults (not a bare clear) so cloud sync can replicate the reset.
  // Receiving devices normalize against their full route list → Others refill in catalog order.
  saveNavLayout(createDefaultNavLayout([...DEFAULT_FAVOURITE_PATHS]))
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
