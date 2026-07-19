/** Theme preference (auto/light/dark) — syncs via fullArchive (LWW by updatedAt). */

import {
  parseThemePreference,
  resolveTheme,
  type ThemePreference,
} from '../utils/dayNightTheme'

export const THEME_PREF_KEY = 'mydsp_theme'
export const THEME_PREF_META_KEY = 'mydsp_theme_meta_v1'

export type ThemePrefBackup = {
  preference: ThemePreference
  updatedAt: string
}

function normalize(raw: string | null | undefined): ThemePreference {
  return parseThemePreference(raw ?? null) ?? 'auto'
}

export function loadThemePreference(): ThemePreference {
  try {
    return normalize(localStorage.getItem(THEME_PREF_KEY))
  } catch {
    return 'auto'
  }
}

export function saveThemePreference(
  preference: ThemePreference,
  opts?: { markDirty?: boolean },
): void {
  const nextPref = normalize(preference)
  const next: ThemePrefBackup = {
    preference: nextPref,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(THEME_PREF_KEY, nextPref)
    localStorage.setItem(THEME_PREF_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportThemePrefForBackup(): ThemePrefBackup | null {
  try {
    const metaRaw = localStorage.getItem(THEME_PREF_META_KEY)
    if (metaRaw) {
      const parsed = JSON.parse(metaRaw) as ThemePrefBackup
      return {
        preference: normalize(parsed.preference),
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      }
    }
    return { preference: loadThemePreference(), updatedAt: new Date(0).toISOString() }
  } catch {
    return null
  }
}

function applyThemeDom(preference: ThemePreference): void {
  if (typeof document === 'undefined') return
  const next = resolveTheme(preference)
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(next)
  const chrome = next === 'light' ? '#ffffff' : '#000000'
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', chrome)
  }
}

export function importThemePrefFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as ThemePrefBackup
  const local = exportThemePrefForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  const preference = normalize(
    typeof remote.preference === 'string' ? remote.preference : 'auto',
  )
  try {
    localStorage.setItem(THEME_PREF_KEY, preference)
    localStorage.setItem(
      THEME_PREF_META_KEY,
      JSON.stringify({
        preference,
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
  applyThemeDom(preference)
  try {
    window.dispatchEvent(
      new CustomEvent('mydsp-theme-pref', { detail: { preference } }),
    )
  } catch {
    /* ignore */
  }
}
