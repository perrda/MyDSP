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
    version: '1.2.153',
    date: '2026-09-01',
    bullets: [
      {
        text: 'First Unlock replaces leftover YouTube / News / Markets on a MacBook',
        to: '/youtube',
      },
      {
        text: 'Mini’s channels, tags, and watchlist win until extras have landed',
        to: '/settings#sync',
      },
      {
        text: 'Later pulls still union so a channel added on MacBook reaches Mini',
        to: '/youtube',
      },
    ],
  },
  {
    version: '1.2.152',
    date: '2026-09-01',
    bullets: [
      {
        text: 'MacBook does not invent factory News / Markets lists before Unlock',
        to: '/youtube',
      },
      {
        text: 'Unlock still pulls Mini’s tags, watchlist, prices, and book',
        to: '/settings#sync',
      },
      {
        text: 'Mini keeps the usual starter News / Markets set',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.151',
    date: '2026-09-01',
    bullets: [
      {
        text: 'MacBook pulls Mini’s YouTube list again if the last sync skipped extras',
        to: '/youtube',
      },
      {
        text: 'Unlock & pull still never overwrites Mini',
        to: '/settings#sync',
      },
      {
        text: 'Mini stays the book — Automatic off still pushes your edits',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.150',
    date: '2026-09-01',
    bullets: [
      {
        text: 'Add a YouTube channel or holding on Mini — it pushes even if Automatic sync is off',
        to: '/settings#sync',
      },
      {
        text: 'MacBook still pulls only until Unlock — it cannot overwrite Mini',
        to: '/youtube',
      },
      {
        text: 'Turning on “This device is the book” asks first — only Mini should be the book',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.149',
    date: '2026-09-01',
    bullets: [
      {
        text: 'Unlock on YouTube / News / Markets pulls Mini’s list — same passphrase',
        to: '/youtube',
      },
      {
        text: 'News / Markets / portfolio book land on that same Unlock & pull',
        to: '/settings#sync',
      },
      {
        text: 'Channels on this Mac stay local until you unlock — they are not the full Mini list',
        to: '/youtube',
      },
      {
        text: 'Add a channel on any unlocked device — Mini Backup now also pushes the list',
        to: '/settings#sync',
      },
      {
        text: 'Backup on Mini pushes even if Automatic sync is off — same passphrase',
        to: '/settings#sync',
      },
      {
        text: 'MacBook Settings Sync / Refresh pull Mini — they never overwrite the book',
        to: '/settings#sync',
      },
      {
        text: 'Unlock also lands Mini’s last FX rates with the channel list',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.148',
    date: '2026-09-01',
    bullets: [
      {
        text: 'Refresh pulls live FX with TSLA / MSTR / BTC / ADA — not a day-old rate',
        to: '/equities',
      },
      {
        text: 'Markets watchlist refreshes with that FX even off the Markets page; still-£0 lines fill from last-synced marks',
        to: '/markets',
      },
      {
        text: 'Finnhub + CoinGecko stay the feeds — Cloudflare is hosting only',
        to: '/settings#prices',
      },
    ],
  },
  {
    version: '1.2.147',
    date: '2026-08-31',
    bullets: [
      {
        text: 'Andrew gifted shares and prices land — SIPP + Fund & Share TSLA/MSTR + ADA',
        to: '/equities',
      },
      {
        text: 'Refresh and profile switch fill family-book marks so NW is not £0',
        to: '/equities',
      },
      {
        text: 'Switching profiles no longer wipes Andrew’s gifted rows',
        to: '/equities',
      },
    ],
  },
  {
    version: '1.2.146',
    date: '2026-08-31',
    bullets: [
      {
        text: 'Mum / Andrew / Thomas / Rebecca / James King gifted shares land again',
        to: '/equities',
      },
      {
        text: 'Refresh prices every family book — unpriced lines were hidden from NW',
        to: '/equities',
      },
      {
        text: 'Mini REPLACE no longer wipes those sleeves on this device',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.145',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Holding ⋯ is Edit + Delete — the sheet is no longer clipped',
        to: '/equities',
      },
      {
        text: 'Edit opens Edit / Buy / Sell — qty, price, date, commentary',
        to: '/equities',
      },
      {
        text: 'Same Edit sheet on Crypto (BTC, ADA, …)',
        to: '/crypto',
      },
    ],
  },
  {
    version: '1.2.144',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Today TREND chips: 24H, 7D, 30D, 6M, YTD, 12M, 5Y, ALL',
        to: '/',
      },
      {
        text: '7D / 30D / 6M now match the other capital labels',
        to: '/',
      },
      {
        text: 'Draft only — live stays 1.2.141',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.143',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Thomas + Rebecca: 100 TSLA and 97 MSTR each',
        to: '/equities',
      },
      {
        text: 'Mum: 109 TSLA and 108 MSTR',
        to: '/equities',
      },
      {
        text: 'James King: 182 TSLA, 90 MSTR, and 3,000 ADA',
        to: '/crypto',
      },
    ],
  },
  {
    version: '1.2.141',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Charts show X labels and Y in the toolbar CCY',
        to: '/',
      },
      {
        text: 'Markets detail trend opens on Fetching rows — 176px axes',
        to: '/markets',
      },
      {
        text: 'Today TREND defaults to 30D — active window is BTC orange',
        to: '/',
      },
      {
        text: 'Draft only — live stays 1.2.137',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.140',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Today TREND adds 6m and YTD between 30D and 12M',
        to: '/',
      },
      {
        text: '6M months and YTD Jan→now — January uses days',
        to: '/',
      },
      {
        text: 'Draft only — live stays 1.2.137',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.139',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Reset a profile to zero — David included',
        to: '/settings#portfolios',
      },
      {
        text: 'Delete other profiles — David cannot be deleted',
        to: '/settings#portfolios',
      },
      {
        text: 'Both ask “Are you sure?” first',
        to: '/settings#portfolios',
      },
    ],
  },
  {
    version: '1.2.137',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Today trend fills the card — 24H / 7D / 30D / 12M / 5Y / ALL',
        to: '/',
      },
      {
        text: 'X-axis weekdays, DD/MM, months, and years — Y follows CCY',
        to: '/',
      },
      {
        text: 'Draft only — live stays 1.2.132',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.135',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Values, charts, and lists sit above help boxes',
        to: '/crypto',
      },
      {
        text: 'Same order on Equities, Tax, Plan, and Compare',
        to: '/equities',
      },
      {
        text: 'Draft only — live stays 1.2.132',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.134',
    date: '2026-08-30',
    bullets: [
      {
        text: 'SIPP is the Equities total (TSLA / MSTR included)',
        to: '/',
      },
      {
        text: 'Same number as Equities VALUE — not account-type SIPP only',
        to: '/equities',
      },
      {
        text: 'Liabilities line and figure are red (negatives)',
        to: '/liabilities',
      },
      {
        text: 'Drag Money, Plan, and Household tiles — order syncs',
        to: '/money',
      },
      {
        text: 'Hourly Yes/No popup to create a manual backup',
        to: '/settings#full-backup',
      },
      {
        text: 'Draft only — live stays 1.2.132',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.133',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Figures and charts stay inside their boxes when you resize',
        to: '/',
      },
      {
        text: 'Holding VALUE / COST / P&L cards no longer clip long amounts',
        to: '/equities',
      },
      {
        text: 'Same fit on Today, Money, Markets, and Plan tiles',
        to: '/money',
      },
      {
        text: 'Draft only — live stays 1.2.132',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.132',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Weekly Digest, Cloud Sync, and Settings sit below YouTube',
        to: '/',
      },
      {
        text: 'Today is one column — Markets lives in the left nav',
        to: '/markets',
      },
      {
        text: 'Customize no longer lists a Markets checkbox',
        to: '/',
      },
      {
        text: 'Today hero shows Assets, then Net Worth / Crypto / SIPP / Liabilities',
        to: '/',
      },
      {
        text: 'Draft only — live stays 1.2.131',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.131',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Header Refresh samples all six quote providers',
        to: '/settings#prices',
      },
      {
        text: 'Settings Provider health shows OK · time after Refresh',
        to: '/settings#prices',
      },
      {
        text: 'Missing Finnhub key is not marked OK',
        to: '/settings#prices',
      },
      {
        text: 'Draft only — live stays 1.2.130',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.130',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Unlock Sync goes away after a working session',
        to: '/settings#sync',
      },
      {
        text: 'Mini fetches live prices — not 37-minute other-device quotes',
        to: '/markets',
      },
      {
        text: 'Phone News and YouTube sit on the bottom bar',
        to: '/news',
      },
      {
        text: 'Pull-to-refresh replaces Mini’s book on iPhone/iPad',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.129',
    date: '2026-08-30',
    bullets: [
      {
        text: 'MENU: News and YouTube sit under Household',
        to: '/news',
      },
      {
        text: 'Header Refresh is orange — bell lives in …',
        to: '/',
      },
      {
        text: '… menu is icon-only (bell, Privacy, Theme, Glass, Search)',
        to: '/',
      },
      {
        text: 'Draft only — live stays 1.2.128',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.128',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Mini always PUTs the book — last Sync does not skip',
        to: '/settings#sync',
      },
      {
        text: 'Satellite Sync replaces local leftover with Mini’s book',
        to: '/settings#sync',
      },
      {
        text: 'Remember + Automatic stick after unlock — chip shows Synced',
        to: '/settings#sync',
      },
      {
        text: 'Draft only — live stays 1.2.127',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.127',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Cloud Sync: This device is the book — Mini pushes, others pull',
        to: '/settings#sync',
      },
      {
        text: 'Satellite MacBook / iPhone / iPad take Mini as the book',
        to: '/settings#sync',
      },
      {
        text: 'Passphrase once, then Sync. Pull-to-refresh pulls the book',
        to: '/settings#sync',
      },
      {
        text: 'Draft only — live stays 1.2.126',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.126',
    date: '2026-08-30',
    bullets: [
      {
        text: 'Money home: 12 tiles back — Spending through Merchant rules',
        to: '/money',
      },
      {
        text: 'Cockpit leftover + runway + four doors kept above the grid',
        to: '/money',
      },
      {
        text: 'Cloud Sync: passphrase + Sync — baked mydsp-sync Worker',
        to: '/settings#sync',
      },
      {
        text: 'Draft only — live stays 1.2.125',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.125',
    date: '2026-08-29',
    bullets: [
      {
        text: 'Digest recut: Daily / Weekly / Monthly / Quarterly / Annual',
        to: '/?digest=1',
      },
      {
        text: 'KPI chips, allocation donut, NW graph, A4 PDF',
        to: '/?digest=1',
      },
      {
        text: 'Light + Dark orange lock complete — logo tile #F7931A',
        to: '/',
      },
      {
        text: 'Draft only — live stays 1.2.121',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.124',
    date: '2026-08-29',
    bullets: [
      {
        text: 'Light + Dark share BTC orange #F7931A',
        to: '/',
      },
      {
        text: 'No muted brown in Light — lock 29 Aug 2026',
        to: '/',
      },
      {
        text: 'Draft only — live stays 1.2.121',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.123',
    date: '2026-08-29',
    bullets: [
      {
        text: 'Unpriced holdings out of NW, mix, drift, Buy/Sell',
        to: '/crypto',
      },
      {
        text: 'Money cockpit: leftover, runway, four doors',
        to: '/money',
      },
      {
        text: 'FIRE uses cashflow leftover — no silent £1,500',
        to: '/fire',
      },
      {
        text: 'News / YouTube chips + honest Markets / history',
        to: '/news',
      },
      {
        text: 'Draft only — live stays 1.2.122',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.122',
    date: '2026-08-28',
    bullets: [
      {
        text: 'Cashflow page: in, out, leftover, runway',
        to: '/cashflow',
      },
      {
        text: 'Money hub door + Today runway opens Cashflow',
        to: '/money',
      },
      {
        text: 'Honest chart — two ledger months, no fake series',
        to: '/cashflow',
      },
      {
        text: 'One runway: stables ÷ bills, not leftover Infinity',
        to: '/cashflow',
      },
      {
        text: 'Draft only — live stays 1.2.121',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.121',
    date: '2026-08-27',
    bullets: [
      {
        text: 'Today fold: title, then net worth',
        to: '/',
      },
      {
        text: 'Nav: Today · Markets · Money · Plan · Household',
        to: '/money',
      },
      {
        text: 'Alerts once · XP scorebook · one sync card',
        to: '/',
      },
      {
        text: 'Household page + Settings always /settings',
        to: '/household',
      },
      {
        text: 'Honest Markets movers and timeline',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.120',
    date: '2026-08-26',
    bullets: [
      {
        text: 'ISA: crypto mark price, not cost × qty',
        to: '/tax',
      },
      {
        text: 'FIRE years start from net worth',
        to: '/analytics/predictive',
      },
      {
        text: 'Deep-links wait for hydrate (Spending, Todos)',
        to: '/todos',
      },
      {
        text: 'History + CGT use local calendar days',
        to: '/history',
      },
      {
        text: 'Hash #/settings#sync keeps the section',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.119',
    date: '2026-08-26',
    bullets: [
      {
        text: 'Cash runway uses cash/stables, not net worth',
        to: '/',
      },
      {
        text: 'Family NW-only members still roll up',
        to: '/family',
      },
      {
        text: 'To-do due dates stay on the local calendar day',
        to: '/todos',
      },
      {
        text: 'News/YouTube/Markets owned follows included holdings',
        to: '/news',
      },
      {
        text: 'Reminders use live goal progress and real debts',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.118',
    date: '2026-08-26',
    bullets: [
      {
        text: 'Optimizer rolls freed min payments onto remaining debts',
        to: '/optimizer',
      },
      {
        text: 'Analytics surplus after debt service · cash emergency months',
        to: '/analytics/predictive',
      },
      {
        text: 'Markets and reports use the same mark-price engine',
        to: '/markets',
      },
      {
        text: 'Sync Open first lands on Journal rows and To-do lists',
        to: '/journal',
      },
      {
        text: 'Planning honours inflation + scenario from Analytics',
        to: '/planning',
      },
    ],
  },
  {
    version: '1.2.117',
    date: '2026-08-25',
    bullets: [
      {
        text: 'Quote Worker: localhost + LAN origins work again',
        to: '/markets',
      },
      {
        text: 'Planning: crypto cost fallback · honest goal dates',
        to: '/goals',
      },
      {
        text: 'Phone 390: no overflow, no leftover landscape gutter',
        to: '/',
      },
      {
        text: 'USDC cost fallback · Today chips · /household',
        to: '/household',
      },
      {
        text: 'Emergency fund is cash · VWRL/VUSA GBP',
        to: '/goals',
      },
    ],
  },
  {
    version: '1.2.116',
    date: '2026-08-04',
    bullets: [
      {
        text: 'Today presets · Favourites density · Markets Yield hint',
        to: '/',
      },
      {
        text: 'Commodities page · remittance packs · broker alias hints',
        to: '/commodities',
      },
      {
        text: 'Rule dismiss · Analytics→Planning · Docs↔Job · due alerts',
        to: '/spending',
      },
    ],
  },
  {
    version: '1.2.114',
    date: '2026-07-30',
    bullets: [
      {
        text: 'Today reorder+sync · merchant rules · debt due calendar',
        to: '/',
      },
      {
        text: 'Corp actions · staking income · honest broker imports',
        to: '/equities',
      },
      {
        text: 'Job document vault · named scenarios · bottom-tab editor',
        to: '/jobs',
      },
    ],
  },
  {
    version: '1.2.113',
    date: '2026-07-30',
    bullets: [
      {
        text: 'Recurring Undo · dividend ledger · Todos Day overdue',
        to: '/recurring',
      },
      {
        text: 'Jobs funnel · Budgets merchants · FIRE→Planning bridge',
        to: '/jobs',
      },
      {
        text: 'News Owned sticky · YT unread · sync conflict rows',
        to: '/news',
      },
    ],
  },
  {
    version: '1.2.112',
    date: '2026-07-30',
    bullets: [
      {
        text: 'Today cockpit · Optimizer payment · Jobs offer×3',
        to: '/',
      },
      {
        text: 'Trade journal follow-ups · Tax filter · Markets trust strip',
        to: '/equities',
      },
      {
        text: 'Spending→Rules · Notifications · denser Goals/Trips',
        to: '/spending',
      },
    ],
  },
  {
    version: '1.2.111',
    date: '2026-07-30',
    bullets: [
      {
        text: 'Today Next action · Markets Filters stick · money-ops ⋯',
        to: '/',
      },
      {
        text: 'Broker CSV aliases · Tax disposal links · bill deep-links',
        to: '/equities',
      },
      {
        text: 'Sync unlock CTA · Compare Week Δ honesty · content-first',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.110',
    date: '2026-07-30',
    bullets: [
      {
        text: 'Equities/Crypto rows: no ticker/Cost overlap',
        to: '/equities',
      },
      {
        text: 'Resize-safe headers — no crushed HOLDINGS copy',
        to: '/equities',
      },
      {
        text: 'Compact ⋯ page actions across web/tablet/phone',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.109',
    date: '2026-07-30',
    bullets: [
      {
        text: 'Spending/Recurring deep-links · Today money pulse → History',
        to: '/',
      },
      {
        text: 'Liability payment → Spending · price alerts open holdings',
        to: '/liabilities',
      },
      {
        text: 'Content-first Equities/News/YouTube · Jobs calendar ICS',
        to: '/jobs',
      },
      {
        text: 'Markets Filters panel — ownership/alerts under Format+',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.108',
    date: '2026-07-25',
    bullets: [
      {
        text: 'Mobile content-first: no bottom New/Add button bars',
        to: '/todos',
      },
      {
        text: 'Creates live in page header + ⋯ (To Do’s, Jobs, Markets…)',
        to: '/todos',
      },
      {
        text: 'Money ops chrome: Spending · Budgets · Recurring · Tax',
        to: '/spending',
      },
    ],
  },
  {
    version: '1.2.107',
    date: '2026-07-25',
    bullets: [
      {
        text: 'Sync trust: unlock onboarding + pull media from cloud',
        to: '/settings#sync',
      },
      {
        text: 'Last media / favourites sync timestamp in Settings',
        to: '/settings#sync',
      },
      {
        text: 'Favourites density QA — slim thumbs, scroll chips, landscape',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.106',
    date: '2026-07-25',
    bullets: [
      {
        text: 'Favourites phase 2: Daily plan, debt strategies, scenarios',
        to: '/',
      },
      {
        text: 'Markets screener · Jobs calendar · Todos Day view + subtasks',
        to: '/markets',
      },
      {
        text: 'YouTube Shorts filtered · embed preview · News save/read-later',
        to: '/youtube',
      },
    ],
  },
  {
    version: '1.2.105',
    date: '2026-07-25',
    bullets: [
      {
        text: 'YouTube: Shorts filtered out — full-length videos only',
        to: '/youtube',
      },
      {
        text: 'Shorts stripped from feed, cache, sync, and upload alerts',
        to: '/youtube',
      },
      {
        text: 'Finance titles about “shorts” (short selling) still allowed',
        to: '/youtube',
      },
    ],
  },
  {
    version: '1.2.104',
    date: '2026-07-25',
    bullets: [
      {
        text: 'YouTube/News: unlock sync banner when passphrase needed',
        to: '/youtube',
      },
      {
        text: 'Pull applies media even with portfolio conflicts',
        to: '/settings#sync',
      },
      {
        text: 'Tombstones: re-added channels/tags sync again across devices',
        to: '/youtube',
      },
    ],
  },
  {
    version: '1.2.103',
    date: '2026-07-25',
    bullets: [
      {
        text: 'Favourites wave: Today customize, Markets search, media undo',
        to: '/',
      },
      {
        text: 'To Do recurrence + archive restore · Jobs upcoming strip',
        to: '/todos',
      },
      {
        text: 'Liabilities due day · Equities/Crypto richer Add/Edit',
        to: '/liabilities',
      },
    ],
  },
  {
    version: '1.2.102',
    date: '2026-07-25',
    bullets: [
      {
        text: 'Job Tracker: company name first — URL muted underneath',
        to: '/jobs',
      },
      {
        text: 'Dedicated List view with stage + full CRUD per application',
        to: '/jobs',
      },
      {
        text: 'Job detail always shows company; cleaner salary; contact prefs',
        to: '/jobs',
      },
    ],
  },
  {
    version: '1.2.101',
    date: '2026-07-24',
    bullets: [
      {
        text: 'Markets rows: Retag removed — Edit and Remove only',
        to: '/markets',
      },
      {
        text: 'Folder tags still editable via Edit → Tag / folder',
        to: '/markets',
      },
      {
        text: 'Cleaner Markets row chrome on web / tablet / phone',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.100',
    date: '2026-07-24',
    bullets: [
      {
        text: 'Liability commentary: older notes collapse; latest stays open',
        to: '/liabilities',
      },
      {
        text: 'Preferred method of contact — Phone / Email / Web / Other',
        to: '/liabilities',
      },
      {
        text: 'Other method lets you type chat / WhatsApp details',
        to: '/liabilities',
      },
    ],
  },
  {
    version: '1.2.99',
    date: '2026-07-24',
    bullets: [
      {
        text: 'Liabilities: edit & save lender Phone / Email / URL per card or loan',
        to: '/liabilities',
      },
      {
        text: 'Contacts section has Add/Edit inline — Clear all supported',
        to: '/liabilities',
      },
      {
        text: 'Add/Edit liability form includes lender contact fields',
        to: '/liabilities',
      },
    ],
  },
  {
    version: '1.2.98',
    date: '2026-07-24',
    bullets: [
      {
        text: 'Mobile/tablet: no overlapping thumb CTAs (measured heights)',
        to: '/markets',
      },
      {
        text: 'Portrait + landscape phone: thumb bars stay reachable',
        to: '/markets',
      },
      {
        text: 'Markets/News/YouTube thumbs slimmed — Refresh only via … menu',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.97',
    date: '2026-07-24',
    bullets: [
      {
        text: 'Markets: Assets / Timeframe / Format toggles (chips on demand)',
        to: '/markets',
      },
      {
        text: 'Search bar + “Showing n/m prices” status removed',
        to: '/markets',
      },
      {
        text: 'Cleaner Markets sticky toolbar under Prices header',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.96',
    date: '2026-07-24',
    bullets: [
      {
        text: 'Markets: CRYPTO→timeframes→Compact aligned; YTD/ALL added',
        to: '/markets',
      },
      {
        text: 'Larger Prices/section headers match My Crypto scale',
        to: '/markets',
      },
      {
        text: 'Search placeholder + Tag/Yield hint removed from Markets',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.95',
    date: '2026-07-24',
    bullets: [
      {
        text: 'YouTube favourites sync web ↔ tablet ↔ mobile',
        to: '/youtube',
      },
      {
        text: 'News tags/headlines sync; removals stay removed',
        to: '/news',
      },
      {
        text: 'Empty first-open no longer overwrites cloud favourites',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.94',
    date: '2026-07-24',
    bullets: [
      {
        text: 'Markets: compact Compact/Expand/Sort/Sections controls',
        to: '/markets',
      },
      {
        text: 'CRYPTO→CROSSES jump chips as clear segment buttons',
        to: '/markets',
      },
      {
        text: 'Retry all stale removed — 60s poll + … Refresh',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.93',
    date: '2026-07-24',
    bullets: [
      {
        text: 'Markets open on 24H % change (not last-used 12M)',
        to: '/markets',
      },
      {
        text: 'Prices refresh every 60s — quieter, no constant flash',
        to: '/markets',
      },
      {
        text: 'Full Edit pencil icon (no clipped tip)',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.92',
    date: '2026-07-22',
    bullets: [
      {
        text: 'Markets: tickers stay under My Crypto/Equities headers',
        to: '/markets',
      },
      {
        text: 'No clipped % pills between sticky section header and rows',
        to: '/markets',
      },
      {
        text: 'Equities/Crypto holdings sticky totals track search height',
        to: '/equities',
      },
    ],
  },
  {
    version: '1.2.91',
    date: '2026-07-22',
    bullets: [
      {
        text: 'Weekly digest in Sidebar — off Today/Compare hero',
        to: '/',
      },
      {
        text: 'Manual refresh only via … → Refresh (no Sync thumbs)',
        to: '/settings#sync',
      },
      {
        text: 'Cloud sync stays automatic · Unlock sync chip → Settings',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.90',
    date: '2026-07-22',
    bullets: [
      {
        text: 'Markets: brief Refreshing data · auto-refresh (no Sync prices nag)',
        to: '/markets',
      },
      {
        text: 'Unlock sync chip (amber) — passphrase ≠ Markets failure',
        to: '/settings#sync',
      },
      {
        text: 'Partial quote gaps auto-retry once shortly after',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.89',
    date: '2026-07-22',
    bullets: [
      {
        text: 'Concentration Review Holding quiet for a calendar month',
        to: '/equities',
      },
      {
        text: 'To Do launch toasts only for reminder/overdue',
        to: '/',
      },
      {
        text: 'Chart X/Y axis standard (1D→ALL · GBP/USD/THB/BTC)',
        to: '/markets',
      },
    ],
  },
  {
    version: '1.2.88',
    date: '2026-07-22',
    bullets: [
      {
        text: 'Review · Analytics · Optimizer · Planning Sync now thumbs',
        to: '/review',
      },
      {
        text: 'Landscape thumb CTA / sticky Todos·Jobs·Budgets·YouTube',
        to: '/todos',
      },
      {
        text: 'Playwright iPhone/iPad landscape projects + sticky axe',
        to: '/settings#sync',
      },
    ],
  },
  {
    version: '1.2.87',
    date: '2026-07-19',
    bullets: [
      {
        text: 'Notification settings LWW (quiet hours · sound · categories)',
        to: '/settings#sync',
      },
      {
        text: 'Markets Sort/Density/Sync testids · FX Use suggested Undo',
        to: '/markets',
      },
      {
        text: 'Today bill Skip Undo · Budget/FIRE/Runway jumps · What arrived testids',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.86',
    date: '2026-07-19',
    bullets: [
      {
        text: 'Glass · Large text · Theme · Accessibility prefs LWW',
        to: '/settings#sync',
      },
      {
        text: 'Markets sticky filters · Copy % · Undo retag · timeframe/tag testids',
        to: '/markets',
      },
      {
        text: 'Today Mark-all Undo · focus/bill Undo testids · Budget/Cash runway',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.85',
    date: '2026-07-19',
    bullets: [
      {
        text: 'Todos sort · Jobs view · Liabilities RAG · Review month LWW',
        to: '/settings#sync',
      },
      {
        text: 'Markets Yield-sort · quote Edit · Copy price/Share · Add-from-holding',
        to: '/markets',
      },
      {
        text: 'Today follow-up/Snooze Undo · Debt jump · FIRE chip · scroll-spy',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.84',
    date: '2026-07-19',
    bullets: [
      {
        text: 'Webhook · achievements · getting-started · What arrived dismiss LWW',
        to: '/settings#sync',
      },
      {
        text: 'Markets Open holding · price alert · Expand/Collapse · Retag',
        to: '/markets',
      },
      {
        text: 'Today bill/interview Undo · Tax jump · budget next-action',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.83',
    date: '2026-07-19',
    bullets: [
      {
        text: 'Settings sections · Tax year · Journal filter · NW spark LWW',
        to: '/settings#sync',
      },
      {
        text: 'Markets quote Copy/News/Retry · Retry all stale · density trust',
        to: '/markets',
      },
      {
        text: 'Today Goals jump · offline Retry · Focus undo · Analytics thumbs',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.82',
    date: '2026-07-19',
    bullets: [
      {
        text: 'Launch path · UI panels · Markets tag/Yield · Settings jumps LWW',
        to: '/settings#sync',
      },
      {
        text: 'Markets undo remove · stale-from-sync Retry · quote Edit ticker',
        to: '/markets',
      },
      {
        text: 'Today jump chips · All caught up · dismissible What arrived · FIRE thumbs',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.81',
    date: '2026-07-18',
    bullets: [
      {
        text: 'News/YouTube prefs LWW · Favourites layout LWW · Markets delete tombstones',
        to: '/settings#sync',
      },
      {
        text: 'Markets keyboard rows · Add commodity/FX/index thumbs · jump aria-controls',
        to: '/markets',
      },
      {
        text: 'Today Sync thumb · Refresh & open ?refresh=1 · follow-up next-action',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.80',
    date: '2026-07-18',
    bullets: [
      {
        text: 'Bottom nav slots sync · Markets density/collapse LWW · journal What arrived',
        to: '/settings#sync',
      },
      {
        text: 'Markets jump tablist · Compact thumb · section Updated Xm ago · paper NW',
        to: '/markets',
      },
      {
        text: 'Family/Docs/Journal thumbs · Today Jobs follow-up · interview Mark done',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.79',
    date: '2026-07-18',
    bullets: [
      {
        text: 'Todos quick filter · Jobs follow-up filter sync LWW across devices',
        to: '/settings#sync',
      },
      {
        text: 'Markets jump retry · search select · Sync-prices report persists',
        to: '/markets',
      },
      {
        text: 'Today Mark all read · media trust · sidebar News/YT unread dots',
        to: '/',
      },
    ],
  },
  {
    version: '1.2.78',
    date: '2026-07-18',
    bullets: [
      {
        text: 'News headlines via Yahoo RSS · last-good cache like prices',
        to: '/news',
      },
      {
        text: 'YouTube favourite uploads notify in the bell (+ optional desktop)',
        to: '/youtube',
      },
      {
        text: 'Background News/YouTube refresh with header Sync · Settings toggle',
        to: '/settings#alerts',
      },
    ],
  },
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
