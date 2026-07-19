/** Accessibility prefs — syncs via fullArchive (LWW by updatedAt). */

import {
  A11Y_CHART_CB_KEY,
  A11Y_HIGH_CONTRAST_KEY,
  A11Y_REDUCED_MOTION_KEY,
  applyA11yPrefsDom,
  loadA11yChartColourBlind,
  loadA11yHighContrast,
  loadA11yReducedMotion,
  saveA11yChartColourBlind as persistChartCb,
  saveA11yHighContrast as persistHighContrast,
  saveA11yReducedMotion as persistReducedMotion,
} from '../utils/a11yPrefs'

export const A11Y_PREFS_META_KEY = 'mydsp_a11y_prefs_meta_v1'

export type A11yPrefsBackup = {
  reducedMotion: boolean
  highContrast: boolean
  chartColourBlind: boolean
  updatedAt: string
}

function readFlags(): Omit<A11yPrefsBackup, 'updatedAt'> {
  return {
    reducedMotion: loadA11yReducedMotion(),
    highContrast: loadA11yHighContrast(),
    chartColourBlind: loadA11yChartColourBlind(),
  }
}

function writeMeta(flags: Omit<A11yPrefsBackup, 'updatedAt'>, updatedAt: string): void {
  try {
    localStorage.setItem(
      A11Y_PREFS_META_KEY,
      JSON.stringify({ ...flags, updatedAt } satisfies A11yPrefsBackup),
    )
  } catch {
    /* ignore */
  }
}

function markDirty(opts?: { markDirty?: boolean }): void {
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function saveA11yReducedMotionPref(on: boolean, opts?: { markDirty?: boolean }): void {
  persistReducedMotion(on)
  writeMeta({ ...readFlags(), reducedMotion: on }, new Date().toISOString())
  markDirty(opts)
}

export function saveA11yHighContrastPref(on: boolean, opts?: { markDirty?: boolean }): void {
  persistHighContrast(on)
  writeMeta({ ...readFlags(), highContrast: on }, new Date().toISOString())
  markDirty(opts)
}

export function saveA11yChartColourBlindPref(on: boolean, opts?: { markDirty?: boolean }): void {
  persistChartCb(on)
  writeMeta({ ...readFlags(), chartColourBlind: on }, new Date().toISOString())
  markDirty(opts)
}

export function exportA11yPrefsForBackup(): A11yPrefsBackup | null {
  try {
    const metaRaw = localStorage.getItem(A11Y_PREFS_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as A11yPrefsBackup
      return {
        reducedMotion: Boolean(parsed.reducedMotion),
        highContrast: Boolean(parsed.highContrast),
        chartColourBlind: Boolean(parsed.chartColourBlind),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { ...readFlags(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importA11yPrefsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as A11yPrefsBackup
  const local = exportA11yPrefsForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const flags = {
    reducedMotion: Boolean(remote.reducedMotion),
    highContrast: Boolean(remote.highContrast),
    chartColourBlind: Boolean(remote.chartColourBlind),
  }
  try {
    localStorage.setItem(A11Y_REDUCED_MOTION_KEY, flags.reducedMotion ? '1' : '0')
    localStorage.setItem(A11Y_HIGH_CONTRAST_KEY, flags.highContrast ? '1' : '0')
    localStorage.setItem(A11Y_CHART_CB_KEY, flags.chartColourBlind ? '1' : '0')
    writeMeta(flags, remote.updatedAt || new Date().toISOString())
  } catch {
    /* ignore */
  }
  applyA11yPrefsDom()
  try {
    window.dispatchEvent(new CustomEvent('mydsp-a11y-prefs', { detail: flags }))
  } catch {
    /* ignore */
  }
}
