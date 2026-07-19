/** Today net-worth spark window (7d / 30d) — syncs via fullArchive (LWW by updatedAt). */

import type { NwSparkWindow } from './netWorthSparkline'

const KEY = 'mydsp_nw_spark_window_v1'
const META_KEY = 'mydsp_nw_spark_window_meta_v1'

export type NwSparkWindowBackup = {
  days: NwSparkWindow
  updatedAt: string
}

function normalize(raw: string | number | null | undefined): NwSparkWindow {
  if (raw === 30 || raw === '30') return 30
  return 7
}

export function loadNwSparkWindowPref(): NwSparkWindow {
  try {
    return normalize(localStorage.getItem(KEY))
  } catch {
    return 7
  }
}

export function saveNwSparkWindowPref(
  days: NwSparkWindow,
  opts?: { markDirty?: boolean; fromSync?: boolean },
): void {
  const next = normalize(days)
  const updatedAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, String(next))
    if (!opts?.fromSync) {
      localStorage.setItem(META_KEY, JSON.stringify({ days: next, updatedAt }))
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
      return {
        days: normalize(parsed.days),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    if (localStorage.getItem(KEY) == null) return null
    return { days: loadNwSparkWindowPref(), updatedAt: new Date(0).toISOString() }
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
  const days = normalize(remote.days)
  try {
    localStorage.setItem(KEY, String(days))
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        days,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
