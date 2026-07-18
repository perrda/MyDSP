/** Weekly digest highlight line edits — syncs via fullArchive (LWW by updatedAt). */

const KEY = 'mydsp_digest_highlights_v1'

export type DigestHighlightsBackup = {
  lines: string[]
  updatedAt: string
}

export function loadDigestHighlightEdits(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lines?: unknown }
    if (!Array.isArray(parsed.lines)) return null
    return parsed.lines.filter((x): x is string => typeof x === 'string')
  } catch {
    return null
  }
}

export function saveDigestHighlightEdits(
  lines: string[],
  opts?: { markDirty?: boolean },
): void {
  const next: DigestHighlightsBackup = {
    lines: lines.map((l) => l.trim()).filter(Boolean).slice(0, 40),
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function clearDigestHighlightEdits(opts?: { markDirty?: boolean }): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  if (opts?.markDirty !== false) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

export function exportDigestHighlightsForBackup(): DigestHighlightsBackup | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DigestHighlightsBackup
    if (!Array.isArray(parsed.lines)) return null
    return {
      lines: parsed.lines.filter((x): x is string => typeof x === 'string').slice(0, 40),
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function importDigestHighlightsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as DigestHighlightsBackup
  if (!Array.isArray(remote.lines)) return
  const local = exportDigestHighlightsForBackup()
  const remoteAt = Date.parse(remote.updatedAt || '') || 0
  const localAt = Date.parse(local?.updatedAt || '') || 0
  if (local && localAt > remoteAt) return
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        lines: remote.lines
          .filter((x): x is string => typeof x === 'string')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 40),
        updatedAt: remote.updatedAt || new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}
