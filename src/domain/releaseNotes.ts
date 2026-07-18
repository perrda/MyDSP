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
    version: '1.2.77',
    date: '2026-07-18',
    bullets: [
      {
        text: 'Recurring sort · drift/concentration · Spending/News filters sync LWW',
        to: '/settings#sync',
      },
      {
        text: 'Equities/Crypto thumb CTA · jump unavailable badges · tag/Yield toggle',
        to: '/markets',
      },
      {
        text: 'Spending/Liabilities/Goals/Trips thumb · Today debt pulse · Jobs follow-up',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.76',
    date: '2026-07-16',
    bullets: [
      {
        text: 'Quote Worker identity smoke · digest/compare prefs sync · deploy:quote CTA',
        to: '/settings#prices',
      },
      {
        text: 'Markets jump-chip active highlight · paper NW chip · sticky header offsets',
        to: '/markets',
      },
      {
        text: 'Today interview next-action · News/YT Refresh & open · Todos Due today chips',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.75',
    date: '2026-07-16',
    bullets: [
      {
        text: 'Quieter Markets chrome — Sync spinner only, no provider OK strip',
        to: '/markets',
      },
      {
        text: 'Tag + Yield % chips hidden for now · sticky Crypto/Equities jumps',
        to: '/markets',
      },
      {
        text: 'Markets header uses Prices · Markets (Watchlist eyebrow retired)',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.74',
    date: '2026-07-16',
    bullets: [
      {
        text: 'deploy:quote / deploy:sync force --config so mydsp-quote deploys correctly',
        to: '/settings#prices',
      },
      {
        text: 'Wrangler no longer walks up to SPA redirect and redeploys mydspv1',
        to: '/smoke',
      },
      {
        text: 'Success must show Worker mydsp-quote, not mydspv1',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.73',
    date: '2026-07-16',
    bullets: [
      {
        text: 'Compare week-Δ sync · What arrived extras · digest edits persist',
        to: '/settings#sync',
      },
      {
        text: 'Paper NW in Compare/history · News unread Jump-in · Tax/Recurring thumb',
        to: '/',
      },
      {
        text: 'Worker News allowlist smoke · axe Liabilities/Import · PTR Recurring',
        to: '/smoke',
      },
    ],
  },
  {
    version: '1.2.72',
    date: '2026-07-16',
    bullets: [
      {
        text: 'ISA override · YouTube video cache · price alerts sync',
        to: '/settings#sync',
      },
      {
        text: 'Finnhub 429 chip · paper commodity NW · News/YouTube master–detail',
        to: '/markets',
      },
      {
        text: 'PTR Tax/Compare · bill notes · YouTube unread · smoke allowlist',
        to: '/smoke',
      },
    ],
  },
  {
    version: '1.2.71',
    date: '2026-07-16',
    bullets: [
      {
        text: 'Finnhub for 1W/1M/12M equities · key probe · missing-key chip',
        to: '/settings#prices',
      },
      {
        text: 'YouTube via quote Worker · News From Owned · headline cache sync',
        to: '/news',
      },
      {
        text: 'Markets master–detail · oil/gas presets · ISA from holdings',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.70',
    date: '2026-07-16',
    bullets: [
      {
        text: 'Sync prices now — Markets quote cache pushes to other devices',
        to: '/markets',
      },
      {
        text: 'Freshness “From other device” · Today movers age gate + lag chip',
        to: '/',
      },
      {
        text: 'Sync cadence honesty: ~4s push / ~30s pull · PTR no page jump',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.69',
    date: '2026-07-16',
    bullets: [
      {
        text: 'Markets: drag ⋮⋮ to reorder My Crypto / Equities / Commodities / …',
        to: '/markets',
      },
      {
        text: 'Commodities respect 24H/1W/1M/12M · Unavailable instead of stuck Fetching',
        to: '/markets',
      },
      { text: 'Section order syncs with the Markets watchlist backup', to: '/markets' },
    ],
  },
  {
    version: '1.2.68',
    date: '2026-07-16',
    bullets: [
      {
        text: 'My Commodities on Markets — Gold, Silver, Copper (Yahoo futures → GBP)',
        to: '/markets',
      },
      {
        text: 'Finnhub API key high-priority To Do reminder (Settings + Today)',
        to: '/settings#prices',
      },
      { text: 'Commodity aliases (GOLD → GC=F) · COMEX Open/Closed chips', to: '/markets' },
    ],
  },
  {
    version: '1.2.67',
    date: '2026-07-16',
    bullets: [
      { text: 'Recurring: sort by due/paid/amount · monthly total · date-stamped notes', to: '/recurring' },
      { text: "Renamed Todos → To Do's across the app", to: '/todos' },
      'Mark paid stamps Last paid · commentary CRUD like Loans/Cards',
    ],
  },
  {
    version: '1.2.66',
    date: '2026-07-16',
    bullets: [
      { text: 'News Top 10 + By ticker via quote Worker (same path as prices)', to: '/news' },
      { text: 'Markets list style restored · 24H/1W/1M/12M sparklines + %', to: '/markets' },
      'USD shown as USD (never US$) sitewide',
    ],
  },
  {
    version: '1.2.65',
    date: '2026-07-16',
    bullets: [
      {
        text: 'Weekly digest Preview/Share on mobile (no Safari HTML download trap)',
        to: '/',
      },
      { text: 'Axe Crypto/Spending · smoke digest check · windowed aria-live', to: '/smoke' },
      { text: 'Share sync diagnostics · holdings weight sort · sticky totals', to: '/settings#sync' },
    ],
  },
  {
    version: '1.2.64',
    date: '2026-07-16',
    bullets: [
      'Digest editable highlights · budget/runway/FIRE/ISA auto lines',
      'Privacy masks digest £ · Today WTD spend chip',
      'Bottom-nav long-press opens digest',
    ],
  },
  {
    version: '1.2.63',
    date: '2026-07-16',
    bullets: [
      'Tablet digest Preview rail · holdings ↑↓ keyboard',
      'Spending sticky search landscape · Owned weight tip',
      'Swipe Include/Exclude NW polish',
    ],
  },
  {
    version: '1.2.62',
    date: '2026-07-16',
    bullets: [
      'Holdings weight % sort · sticky included totals',
      'Holding detail share summary · Markets Owned weight',
      'Concentration + Owned chip polish',
    ],
  },
  {
    version: '1.2.61',
    date: '2026-07-16',
    bullets: [
      { text: 'Share sync diagnostics · conflict Keep-all Undo', to: '/settings#sync' },
      { text: 'Offline Share error · privacy blocks conflict share', to: '/settings#sync' },
      'Weekly digest in-app modal foundation',
    ],
  },
] as const

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
