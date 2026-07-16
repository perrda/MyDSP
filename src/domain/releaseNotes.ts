/**
 * In-app release notes — UpdateBanner bullets + What’s new archive (last 5 versions).
 * Keep bullets short and aligned with the latest CHANGELOG sections.
 */

export type ReleaseNotesEntry = {
  version: string
  date: string
  bullets: readonly string[]
}

/** Newest first. Archive surfaces the first 5 entries. */
export const RELEASE_NOTES: readonly ReleaseNotesEntry[] = [
  {
    version: '1.2.49',
    date: '2026-07-16',
    bullets: [
      'What’s new archive · ErrorBoundary recovery actions',
      'Skip links for Sync conflicts & Markets cached mode',
      'Smoke Quote/Sync checks · Weekly HTML digest download',
    ],
  },
  {
    version: '1.2.48',
    date: '2026-07-16',
    bullets: [
      'Today next-action stack · NW 7d/30d sparkline',
      'Spending category sparklines · Tax year progress ring',
      'Compare: how to add a second portfolio',
    ],
  },
  {
    version: '1.2.47',
    date: '2026-07-16',
    bullets: [
      'Shared-element style page transitions',
      'Jobs pipeline mini-card · Todos NL quick-add',
      'Settings split nav · PTR Today/Markets only',
    ],
  },
  {
    version: '1.2.46',
    date: '2026-07-16',
    bullets: [
      'Markets Compact/Heat density · per-section refresh',
      'Corporate action notes · Add from holding',
      'FX triangle check for GBP/USD/EUR',
    ],
  },
  {
    version: '1.2.45',
    date: '2026-07-16',
    bullets: [
      'Sync dry-run pull · device nickname',
      'Biometric unlock timeout · setup URL export',
      'Auto-resume after sync pause',
    ],
  },
  {
    version: '1.2.44',
    date: '2026-07-15',
    bullets: [
      'Settings fuzzy search + recent jumps',
      'Household snapshot PDF · Markets Cached mode',
      'verify:bundle budget · UpdateBanner release notes',
    ],
  },
]

/** Return up to `n` bullets from the latest version (banner). */
export function releaseNotesBullets(n = 3): string[] {
  const latest = RELEASE_NOTES[0]
  if (!latest) return []
  return latest.bullets.slice(0, n)
}

/** Last `n` version entries for the What’s new archive (newest first). */
export function releaseNotesArchive(n = 5): ReleaseNotesEntry[] {
  return RELEASE_NOTES.slice(0, n)
}
