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
    version: '1.2.55',
    date: '2026-07-16',
    bullets: [
      { text: 'Settings pin chips · smoke PIN & bottom-nav checks', to: '/smoke' },
      { text: 'What’s new bullets deep-link into Settings', to: '/settings#whats-new' },
      { text: 'Broker CSV alias pack bump (IBKR / T212 / Coinbase)', to: '/settings#trade-history' },
    ],
  },
  {
    version: '1.2.54',
    date: '2026-07-16',
    bullets: [
      'Today bills swipe Mark paid · Spending log bill payment',
      'Goals log note from Today · Tax ISA allowance stub',
      'Compare as-of quote age chips',
    ],
  },
  {
    version: '1.2.53',
    date: '2026-07-16',
    bullets: [
      'Overview double-tap scroll-to-top · bill Mark paid / Skip',
      'Jobs pipeline → Kanban deep-link · OverflowMenu phone sheet',
      'Settings conflict jump FAB',
    ],
  },
  {
    version: '1.2.52',
    date: '2026-07-16',
    bullets: [
      'Markets in-list search · yield % sort',
      'Holdings Use Markets price on drift · corp-action date',
      'FX triangle Use suggested',
    ],
  },
  {
    version: '1.2.51',
    date: '2026-07-16',
    bullets: [
      { text: 'PIN keypad to disable lock · Face ID-first path', to: '/settings#security' },
      { text: 'Sync activity device filter · conflict copy summary', to: '/settings#sync' },
      { text: 'Offline Retry now · passphrase 7-day remember', to: '/settings#sync' },
    ],
  },
  {
    version: '1.2.50',
    date: '2026-07-16',
    bullets: [
      {
        text: 'Face ID-first unlock · phone sync chip no longer overlaps menu',
        to: '/settings#security',
      },
      {
        text: 'Customizable bottom-nav middle tabs · PWA shortcuts + theme-color',
        to: '/settings#layout',
      },
      {
        text: 'Finnhub key how-to + quote failover health in Settings',
        to: '/settings#prices',
      },
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
