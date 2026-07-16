/**
 * In-app release notes — UpdateBanner bullets + What’s new archive (last 5 versions).
 * Keep bullets short and aligned with the latest CHANGELOG sections.
 * Optional `to` deep-links into Settings / app anchors.
 */

export type ReleaseBullet =
  | string
  | {
      text: string
      /** In-app path or hash deep-link, e.g. `/settings#sync` */
      to: string
    }

export type ReleaseNotesEntry = {
  version: string
  date: string
  bullets: readonly ReleaseBullet[]
}

export function releaseBulletText(b: ReleaseBullet): string {
  return typeof b === 'string' ? b : b.text
}

export function releaseBulletHref(b: ReleaseBullet): string | null {
  return typeof b === 'string' ? null : b.to
}

/** Newest first. Archive surfaces the first 5 entries. */
export const RELEASE_NOTES: readonly ReleaseNotesEntry[] = [
  {
    version: '1.2.60',
    date: '2026-07-16',
    bullets: [
      { text: 'Settings lazy-loaded · windowed Equities/Crypto lists', to: '/settings' },
      { text: 'Axe gates for Equities / Tax / Todos · offline-queue smoke', to: '/smoke' },
      { text: 'Sync chip long-press + UI conventions for next25e', to: '/settings#sync' },
    ],
  },
  {
    version: '1.2.59',
    date: '2026-07-16',
    bullets: [
      'Today budget pulse · cash runway · FIRE chip',
      'Spending merchant search · sell→Tax disposal CTA',
      'Goals / bills / FIRE Today polish',
    ],
  },
  {
    version: '1.2.58',
    date: '2026-07-16',
    bullets: [
      'Equities/Crypto master–detail · Today accordions',
      'TradeModal phone sheet · Markets section jump chips',
      'Jobs list|Kanban split',
    ],
  },
  {
    version: '1.2.57',
    date: '2026-07-16',
    bullets: [
      'Holdings weight % · sticky search · Markets Owned chip',
      'Holding detail day% sparkline · concentration banner',
      'Portfolio concentration threshold in Settings',
    ],
  },
  {
    version: '1.2.56',
    date: '2026-07-16',
    bullets: [
      { text: 'Long-press sync chip · What arrived toast', to: '/settings#sync' },
      {
        text: 'Sync health blob age · passphrase rotate · conflict quick-resolve',
        to: '/settings#sync',
      },
      'Offline Retry already in tip · passphrase remember modes',
    ],
  },
  {
    version: '1.2.55',
    date: '2026-07-16',
    bullets: [
      { text: 'Settings pin chips · smoke PIN & bottom-nav checks', to: '/smoke' },
      { text: 'What’s new bullets deep-link into Settings', to: '/settings#whats-new' },
      { text: 'Broker CSV alias pack bump (IBKR / T212 / Coinbase)', to: '/settings#trade-history' },
    ],
  },
]

/** Return up to `n` bullets from the latest version (banner). */
export function releaseNotesBullets(n = 3): ReleaseBullet[] {
  const latest = RELEASE_NOTES[0]
  if (!latest) return []
  return latest.bullets.slice(0, n)
}

/** Last `n` version entries for the What’s new archive (newest first). */
export function releaseNotesArchive(n = 5): ReleaseNotesEntry[] {
  return RELEASE_NOTES.slice(0, n)
}
