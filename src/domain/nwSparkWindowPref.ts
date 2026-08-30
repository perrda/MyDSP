/** Today net-worth trend window — syncs via fullArchive (LWW by updatedAt). */

import type { NwSparkWindow } from './netWorthSparkline'

const KEY = 'mydsp_nw_spark_window_v1'
const META_KEY = 'mydsp_nw_spark_window_meta_v1'

export type NwSparkWindowBackup = {
  /** Legacy 7 / 30, or a canonical window id. */
  days: number | NwSparkWindow
  window?: NwSparkWindow
  updatedAt: string
}

export function normalizeNwSparkWindow(raw: string | number | null | undefined): NwSparkWindow {
  if (raw === 30 || raw === '30' || raw === '30D' || raw === '30d') return '30D'
  if (raw === 7 || raw === '7' || raw === '7D' || raw === '7d') return '7D'
  if (raw === '24H' || raw === '24h') return '24H'
  if (raw === '6M' || raw === '6m') return '6M'
  if (raw === 'YTD' || raw === 'ytd') return 'YTD'
  if (raw === '12M' || raw === '12m') return '12M'
  if (raw === '5Y' || raw === '5y') return '5Y'
  if (raw === 'ALL' || raw === 'all') return 'ALL'
  return '30D'
}

function backupDays(window: NwSparkWindow): number | NwSparkWindow {
  if (window === '7D') return 7
  if (window === '30D') return 30
  return window
}

export function loadNwSparkWindowPref(): NwSparkWindow {
  try {
    return normalizeNwSparkWindow(localStorage.getItem(KEY))
  } catch {
    return '30D'
  }
}

export function saveNwSparkWindowPref(
  days: NwSparkWindow | 7 | 30,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const next = normalizeNwSparkWindow(days)
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, next)
    if (!opts?.fromSync) {
      localStorage.setItem(
        META_KEY,
        JSON.stringify({ days: backupDays(next), window: next, updatedAt }),
      )
    }
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false && !opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportNwSparkWindowForBackup(): NwSparkWindowBackup | null {
  try {
    const metaRaw = localStorage.getItem(META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as NwSparkWindowBackup
      const window = normalizeNwSparkWindow(parsed.window ?? parsed.days)
      return {
        days: parsed.days ?? backupDays(window),
        window,
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    if (localStorage.getItem(KEY) == null) return null
    const window = loadNwSparkWindowPref()
    return { days: backupDays(window), window, updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importNwSparkWindowFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as NwSparkWindowBackup
  const local = exportNwSparkWindowForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const window = normalizeNwSparkWindow(remote.window ?? remote.days)
  try {
    localStorage.setItem(KEY, window)
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        days: remote.days ?? backupDays(window),
        window,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
