/** Persist weekly digest highlight line edits across sessions (device-local). */

const KEY = 'mydsp_digest_highlights_v1'

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

export function saveDigestHighlightEdits(lines: string[]): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        lines: lines.map((l) => l.trim()).filter(Boolean).slice(0, 40),
        updatedAt: new Date().toISOString(),
      }),
    )
  } catch {
    /* ignore */
  }
}

export function clearDigestHighlightEdits(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
