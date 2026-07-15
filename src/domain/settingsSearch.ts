/** Fuzzy Settings section search + recent jump chips (localStorage). */

export const SETTINGS_RECENT_KEY = 'mydsp_settings_recent_jumps_v1'
export const SETTINGS_RECENT_MAX = 5

export type SettingsSectionId = string

/** Score a settings section for a query: startsWith > includes on id/keywords. */
export function scoreSettingsSection(
  query: string,
  id: string,
  keywords: string,
): number {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return 0

  const idLower = id.toLowerCase()
  const hay = `${idLower} ${keywords.toLowerCase()}`
  const tokens = hay.split(/\s+/).filter(Boolean)

  let best = 0

  if (idLower === q) best = Math.max(best, 1)
  if (idLower.startsWith(q)) best = Math.max(best, 0.95)
  if (idLower.includes(q)) best = Math.max(best, 0.8)

  for (const token of tokens) {
    if (token === q) best = Math.max(best, 0.98)
    if (token.startsWith(q)) best = Math.max(best, 0.9)
    if (token.includes(q)) best = Math.max(best, 0.75)
    if (q.includes(token) && token.length >= 3) best = Math.max(best, 0.55)
  }

  if (hay.includes(q)) best = Math.max(best, 0.7)

  return best
}

export function rankSettingsSections<T extends string>(
  query: string,
  ids: readonly T[],
  keywords: Record<T, string>,
  minScore = 0.55,
): Array<{ id: T; score: number }> {
  const ranked = ids
    .map((id) => ({
      id,
      score: scoreSettingsSection(query, id, keywords[id] ?? ''),
    }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return ranked
}

export function loadRecentSettingsJumps(
  storage: Storage = localStorage,
): string[] {
  try {
    const raw = storage.getItem(SETTINGS_RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, SETTINGS_RECENT_MAX)
  } catch {
    return []
  }
}

export function saveRecentSettingsJumps(
  ids: string[],
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(
      SETTINGS_RECENT_KEY,
      JSON.stringify(ids.slice(0, SETTINGS_RECENT_MAX)),
    )
  } catch {
    /* quota / private mode */
  }
}

/** Push a section id to the front of recent jumps (deduped). */
export function recordSettingsJump(
  id: string,
  storage: Storage = localStorage,
): string[] {
  const prev = loadRecentSettingsJumps(storage).filter((x) => x !== id)
  const next = [id, ...prev].slice(0, SETTINGS_RECENT_MAX)
  saveRecentSettingsJumps(next, storage)
  return next
}

/** Human label for a settings section id (chip text). */
export function settingsSectionLabel(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
