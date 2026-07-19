/** Session-scoped “just synced in” entity highlights for cross-device polish. */

import type { PortfolioData } from '../../domain/types'

export type SyncHighlightCollection =
  | 'todoItems'
  | 'todoLists'
  | 'jobApplications'
  | 'spending'
  | 'goals'
  | 'journal'

export type SyncHighlightMap = Partial<Record<SyncHighlightCollection, number[]>>

const KEY = 'mydsp_sync_highlights_v1'
const TTL_MS = 8_000

const COLLECTION_LABELS: Record<SyncHighlightCollection, [singular: string, plural: string]> = {
  todoItems: ["To Do", "To Do's"],
  todoLists: ["To Do list", "To Do's"],
  jobApplications: ['job application', 'job applications'],
  spending: ['spending row', 'spending rows'],
  goals: ['goal', 'goals'],
  journal: ['journal entry', 'journal entries'],
}

type Stored = {
  at: number
  ids: SyncHighlightMap
}

export function setSyncHighlights(ids: SyncHighlightMap): void {
  try {
    const payload: Stored = { at: Date.now(), ids }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function consumeSyncHighlights(): SyncHighlightMap {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    sessionStorage.removeItem(KEY)
    const parsed = JSON.parse(raw) as Stored
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) return {}
    return parsed.ids ?? {}
  } catch {
    return {}
  }
}

export function peekSyncHighlights(): SyncHighlightMap {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Stored
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) return {}
    return parsed.ids ?? {}
  } catch {
    return {}
  }
}

export function clearSyncHighlights(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function summarizeSyncHighlights(ids: SyncHighlightMap, maxParts = 4): string | null {
  const parts = (Object.keys(COLLECTION_LABELS) as SyncHighlightCollection[])
    .map((key) => {
      const count = ids[key]?.length ?? 0
      if (count <= 0) return null
      const [one, many] = COLLECTION_LABELS[key]
      return `${count} ${count === 1 ? one : many}`
    })
    .filter((part): part is string => Boolean(part))

  if (parts.length === 0) return null
  const shown = parts.slice(0, maxParts)
  const hidden = parts.length - shown.length
  return hidden > 0 ? `${shown.join(' · ')} · ${hidden} more` : shown.join(' · ')
}

/** Deep-link to the first entity that arrived in a sync highlight map. */
export function firstSyncHighlightHref(ids: SyncHighlightMap | null | undefined): string | null {
  if (!ids) return null
  const order: SyncHighlightCollection[] = [
    'todoItems',
    'todoLists',
    'jobApplications',
    'goals',
    'spending',
    'journal',
  ]
  for (const key of order) {
    const id = ids[key]?.[0]
    if (id == null) continue
    if (key === 'todoItems') return `/todos?focus=${id}`
    if (key === 'todoLists') return `/todos?list=${id}`
    if (key === 'jobApplications') return `/jobs/${id}`
    if (key === 'goals') return `/goals?note=${id}`
    if (key === 'spending') return `/spending?highlight=${id}`
    if (key === 'journal') return `/journal?highlight=${id}`
  }
  return null
}

/** Human labels for workspace extras applied on pull (quotes, media caches, ISA, …). */
export type WorkspaceExtrasFlags = {
  marketQuotes?: boolean
  newsArticles?: boolean
  youtubeVideos?: boolean
  isaRemaining?: boolean
  priceAlertThresholds?: boolean
  compareWeekSnapshot?: boolean
  digestHighlights?: boolean
  compareSelection?: boolean
  recurringSort?: boolean
  holdingsDrift?: boolean
  portfolioConcentration?: boolean
  spendingFilters?: boolean
  newsFilter?: boolean
  todosQuickFilter?: boolean
  jobsFilter?: boolean
  bottomNavSlots?: boolean
  navLayout?: boolean
  launchPath?: boolean
  uiPanels?: boolean
  settingsSections?: boolean
  marketsTagYield?: boolean
  settingsRecentJumps?: boolean
  taxYear?: boolean
  journalFilter?: boolean
  nwSparkWindow?: boolean
  webhookUrl?: boolean
  achievementsSeen?: boolean
  gettingStartedDismissed?: boolean
  whatArrivedDismiss?: boolean
  todosSort?: boolean
  jobsView?: boolean
  liabilitiesRag?: boolean
  reviewMonth?: boolean
  markets?: boolean
  news?: boolean
  youtube?: boolean
}

const EXTRAS_LABELS: Array<[keyof WorkspaceExtrasFlags, string]> = [
  ['marketQuotes', 'Markets quotes'],
  ['newsArticles', 'News headlines'],
  ['youtubeVideos', 'YouTube videos'],
  ['isaRemaining', 'ISA override'],
  ['priceAlertThresholds', 'price alerts'],
  ['compareWeekSnapshot', 'Compare week-Δ'],
  ['digestHighlights', 'digest highlights'],
  ['compareSelection', 'Compare selection'],
  ['recurringSort', 'Recurring sort'],
  ['holdingsDrift', 'drift threshold'],
  ['portfolioConcentration', 'concentration threshold'],
  ['spendingFilters', 'Spending filters'],
  ['newsFilter', 'News filter'],
  ['todosQuickFilter', 'Todos quick filter'],
  ['jobsFilter', 'Jobs filter'],
  ['bottomNavSlots', 'Bottom nav slots'],
  ['navLayout', 'Favourites layout'],
  ['launchPath', 'Launch path'],
  ['uiPanels', 'UI panels'],
  ['settingsSections', 'Settings sections'],
  ['marketsTagYield', 'Markets tag/Yield chips'],
  ['settingsRecentJumps', 'Settings jumps'],
  ['taxYear', 'Tax year'],
  ['journalFilter', 'Journal filter'],
  ['nwSparkWindow', 'NW spark window'],
  ['webhookUrl', 'API webhook URL'],
  ['achievementsSeen', 'Achievements seen'],
  ['gettingStartedDismissed', 'Getting started dismissed'],
  ['whatArrivedDismiss', 'What arrived dismiss'],
  ['todosSort', 'Todos sort'],
  ['jobsView', 'Jobs view'],
  ['liabilitiesRag', 'Liabilities RAG'],
  ['reviewMonth', 'Review month'],
  ['markets', 'Markets watchlist'],
  ['news', 'News tags'],
  ['youtube', 'YouTube channels'],
]

export function summarizeWorkspaceExtras(
  extras: WorkspaceExtrasFlags | null | undefined,
  maxParts = 4,
): string | null {
  if (!extras) return null
  const parts = EXTRAS_LABELS.filter(([k]) => Boolean(extras[k])).map(([, label]) => label)
  if (parts.length === 0) return null
  const shown = parts.slice(0, maxParts)
  const hidden = parts.length - shown.length
  return hidden > 0 ? `${shown.join(' · ')} · ${hidden} more` : shown.join(' · ')
}

export function workspaceExtrasFlagsFromPreview(extras: {
  marketQuotes?: unknown
  newsArticles?: unknown
  youtubeVideos?: unknown
  isaRemaining?: unknown
  priceAlertThresholds?: unknown
  compareWeekSnapshot?: unknown
  digestHighlights?: unknown
  compareSelection?: unknown
  recurringSort?: unknown
  holdingsDrift?: unknown
  portfolioConcentration?: unknown
  spendingFilters?: unknown
  newsFilter?: unknown
  todosQuickFilter?: unknown
  jobsFilter?: unknown
  bottomNavSlots?: unknown
  navLayout?: unknown
  launchPath?: unknown
  uiPanels?: unknown
  settingsSections?: unknown
  marketsTagYield?: unknown
  settingsRecentJumps?: unknown
  taxYear?: unknown
  journalFilter?: unknown
  nwSparkWindow?: unknown
  webhookUrl?: unknown
  achievementsSeen?: unknown
  gettingStartedDismissed?: unknown
  whatArrivedDismiss?: unknown
  todosSort?: unknown
  jobsView?: unknown
  liabilitiesRag?: unknown
  reviewMonth?: unknown
  markets?: unknown
  news?: unknown
  youtube?: unknown
} | null | undefined): WorkspaceExtrasFlags {
  if (!extras) return {}
  return {
    marketQuotes: extras.marketQuotes != null,
    newsArticles: extras.newsArticles != null,
    youtubeVideos: extras.youtubeVideos != null,
    isaRemaining: extras.isaRemaining != null,
    priceAlertThresholds: extras.priceAlertThresholds != null,
    compareWeekSnapshot: extras.compareWeekSnapshot != null,
    digestHighlights: extras.digestHighlights != null,
    compareSelection: extras.compareSelection != null,
    recurringSort: extras.recurringSort != null,
    holdingsDrift: extras.holdingsDrift != null,
    portfolioConcentration: extras.portfolioConcentration != null,
    spendingFilters: extras.spendingFilters != null,
    newsFilter: extras.newsFilter != null,
    todosQuickFilter: extras.todosQuickFilter != null,
    jobsFilter: extras.jobsFilter != null,
    bottomNavSlots: extras.bottomNavSlots != null,
    navLayout: extras.navLayout != null,
    launchPath: extras.launchPath != null,
    uiPanels: extras.uiPanels != null,
    settingsSections: extras.settingsSections != null,
    marketsTagYield: extras.marketsTagYield != null,
    settingsRecentJumps: extras.settingsRecentJumps != null,
    taxYear: extras.taxYear != null,
    journalFilter: extras.journalFilter != null,
    nwSparkWindow: extras.nwSparkWindow != null,
    webhookUrl: extras.webhookUrl != null,
    achievementsSeen: extras.achievementsSeen != null,
    gettingStartedDismissed: extras.gettingStartedDismissed != null,
    whatArrivedDismiss: extras.whatArrivedDismiss != null,
    todosSort: extras.todosSort != null,
    jobsView: extras.jobsView != null,
    liabilitiesRag: extras.liabilitiesRag != null,
    reviewMonth: extras.reviewMonth != null,
    markets: extras.markets != null,
    news: extras.news != null,
    youtube: extras.youtube != null,
  }
}

/** Diff numeric ids present on remote but not local. */
export function diffNewIds<T extends { id: number }>(local: T[], remote: T[]): number[] {
  const have = new Set(local.map((x) => x.id))
  return remote.filter((x) => !have.has(x.id)).map((x) => x.id)
}

/** Collect entity ids that exist on remote but not local (pre-merge). */
export function collectSyncHighlights(
  pairs: Array<{ local: PortfolioData | null; remote: PortfolioData }>,
): SyncHighlightMap {
  const out: SyncHighlightMap = {}
  const bump = (key: keyof SyncHighlightMap, ids: number[]) => {
    if (ids.length === 0) return
    out[key] = [...(out[key] ?? []), ...ids]
  }
  for (const { local, remote } of pairs) {
    if (!local) {
      bump(
        'todoItems',
        (remote.todoItems ?? []).map((t) => t.id),
      )
      bump(
        'todoLists',
        (remote.todoLists ?? []).map((t) => t.id),
      )
      bump(
        'jobApplications',
        (remote.jobApplications ?? []).map((t) => t.id),
      )
      bump(
        'goals',
        (remote.goals ?? []).map((t) => t.id),
      )
      bump(
        'spending',
        (remote.spending ?? []).map((t) => t.id),
      )
      bump(
        'journal',
        (remote.journal ?? []).map((t) => t.id),
      )
      continue
    }
    bump('todoItems', diffNewIds(local.todoItems ?? [], remote.todoItems ?? []))
    bump('todoLists', diffNewIds(local.todoLists ?? [], remote.todoLists ?? []))
    bump('jobApplications', diffNewIds(local.jobApplications ?? [], remote.jobApplications ?? []))
    bump('goals', diffNewIds(local.goals ?? [], remote.goals ?? []))
    bump('spending', diffNewIds(local.spending ?? [], remote.spending ?? []))
    bump('journal', diffNewIds(local.journal ?? [], remote.journal ?? []))
  }
  return out
}
