/** Glass Mode — syncs via fullArchive (LWW by updatedAt). */

import {
  applyGlassDom,
  GLASS_STORAGE_KEY,
  loadGlassMode,
  saveGlassMode as persistGlassFlag,
} from '../utils/glassMode'

export const GLASS_MODE_META_KEY = 'mydsp_glass_mode_meta_v1'

export type GlassModeBackup = {
  on: boolean
  updatedAt: string
}

export function saveGlassModePref(on: boolean, opts?: { markDirty?: boolean }): void {
  persistGlassFlag(on)
  const next: GlassModeBackup = {
    on,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(GLASS_MODE_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportGlassModeForBackup(): GlassModeBackup | null {
  try {
    const metaRaw = localStorage.getItem(GLASS_MODE_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as GlassModeBackup
      return {
        on: Boolean(parsed.on),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { on: loadGlassMode(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importGlassModeFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as GlassModeBackup
  const local = exportGlassModeForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const on = Boolean(remote.on)
  try {
    localStorage.setItem(GLASS_STORAGE_KEY, on ? '1' : '0')
    localStorage.setItem(
      GLASS_MODE_META_KEY,
      JSON.stringify({
        on,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
  applyGlassDom(on)
  try {
    window.dispatchEvent(new CustomEvent('mydsp-glass-pref', { detail: { on } }))
  } catch {
    /* ignore */
  }
}
