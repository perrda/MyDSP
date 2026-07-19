/** Large text mode — syncs via fullArchive (LWW by updatedAt). */

import {
  applyLargeTextDom,
  LARGE_TEXT_STORAGE_KEY,
  loadLargeText,
  saveLargeText as persistLargeTextFlag,
} from '../utils/largeText'

export const LARGE_TEXT_META_KEY = 'mydsp_large_text_meta_v1'

export type LargeTextBackup = {
  on: boolean
  updatedAt: string
}

export function saveLargeTextPref(on: boolean, opts?: { markDirty?: boolean }): void {
  persistLargeTextFlag(on)
  const next: LargeTextBackup = {
    on,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(LARGE_TEXT_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportLargeTextForBackup(): LargeTextBackup | null {
  try {
    const metaRaw = localStorage.getItem(LARGE_TEXT_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as LargeTextBackup
      return {
        on: Boolean(parsed.on),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { on: loadLargeText(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

export function importLargeTextFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as LargeTextBackup
  const local = exportLargeTextForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const on = Boolean(remote.on)
  try {
    localStorage.setItem(LARGE_TEXT_STORAGE_KEY, on ? '1' : '0')
    localStorage.setItem(
      LARGE_TEXT_META_KEY,
      JSON.stringify({
        on,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
  applyLargeTextDom(on)
  try {
    window.dispatchEvent(new CustomEvent('mydsp-large-text-pref', { detail: { on } }))
  } catch {
    /* ignore */
  }
}
