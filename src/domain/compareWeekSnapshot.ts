/** Previous-week net-worth snapshots for Compare “what changed” column. */

const KEY = 'mydsp_compare_nw_week_v1'
const META_KEY = 'mydsp_compare_nw_week_meta_v1'

export type CompareWeekSnapshotStore = {
  /** ISO week key e.g. 2026-W28 */
  weekKey: string
  /** Net worth by portfolio id at first visit of the current week (frozen) */
  current: Record<string, number>
  /** Net worth by portfolio id from the previous calendar week */
  previous: Record<string, number>
  capturedAt: string
}

/** Monday-based ISO week key in local time. */
export function isoWeekKey(d: Date = new Date()): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // Thursday in current week decides the year
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  const week =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function loadCompareWeekSnapshot(): CompareWeekSnapshotStore | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CompareWeekSnapshotStore
    if (!parsed || typeof parsed.weekKey !== 'string') return null
    if (!parsed.current || typeof parsed.current !== 'object') return null
    return {
      weekKey: parsed.weekKey,
      current: parsed.current ?? {},
      previous: parsed.previous && typeof parsed.previous === 'object' ? parsed.previous : {},
      capturedAt: typeof parsed.capturedAt === 'string' ? parsed.capturedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function writeStore(store: CompareWeekSnapshotStore, opts?: { markDirty?: boolean }): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ updatedAt: store.capturedAt || new Date().toISOString() }),
    )
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportCompareWeekSnapshotForBackup(): CompareWeekSnapshotStore | null {
  return loadCompareWeekSnapshot()
}

/** LWW by capturedAt — prefer newer week snapshot. */
export function importCompareWeekSnapshotFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as CompareWeekSnapshotStore
  if (typeof remote.weekKey !== 'string' || !remote.current || typeof remote.current !== 'object') {
    return
  }
  const local = loadCompareWeekSnapshot()
  const remoteAt = Date.parse(remote.capturedAt || '') || 0
  const localAt = Date.parse(local?.capturedAt || '') || 0
  if (local && localAt > remoteAt) return
  writeStore(
    {
      weekKey: remote.weekKey,
      current: remote.current ?? {},
      previous:
        remote.previous && typeof remote.previous === 'object' ? remote.previous : {},
      capturedAt: remote.capturedAt || new Date().toISOString(),
    },
    { markDirty: false },
  )
}

/**
 * Ensure we have a previous-week baseline.
 * When the ISO week rolls, move `current` → `previous` and freeze a new week-start `current`.
 * Same week: keep `current` frozen; only add newly seen portfolio ids.
 */
export function syncCompareWeekSnapshots(
  netWorthById: Record<string, number>,
  now: Date = new Date(),
): CompareWeekSnapshotStore {
  const weekKey = isoWeekKey(now)
  const existing = loadCompareWeekSnapshot()
  if (!existing) {
    const store: CompareWeekSnapshotStore = {
      weekKey,
      current: { ...netWorthById },
      previous: {},
      capturedAt: now.toISOString(),
    }
    writeStore(store)
    return store
  }
  if (existing.weekKey !== weekKey) {
    const store: CompareWeekSnapshotStore = {
      weekKey,
      current: { ...netWorthById },
      previous: { ...existing.current },
      capturedAt: now.toISOString(),
    }
    writeStore(store)
    return store
  }
  // Same week: freeze week-start; seed any new portfolio ids only
  let changed = false
  const current = { ...existing.current }
  for (const [id, nw] of Object.entries(netWorthById)) {
    if (current[id] == null) {
      current[id] = nw
      changed = true
    }
  }
  if (!changed) return existing
  const store: CompareWeekSnapshotStore = { ...existing, current }
  writeStore(store)
  return store
}

/** Delta vs previous-week snapshot (null when no baseline). */
export function weekOverWeekDelta(
  portfolioId: string,
  currentNetWorth: number,
  store: CompareWeekSnapshotStore | null,
): number | null {
  if (!store) return null
  const prev = store.previous[portfolioId]
  if (prev == null || !Number.isFinite(prev)) return null
  return currentNetWorth - prev
}
