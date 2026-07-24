/** News watchlist — top financial headlines + ticker meta-tags. */

export interface NewsTag {
  id: string
  /** Ticker / topic e.g. TSLA, BTC, ADA */
  tag: string
  label: string
  createdAt: string
  sortOrder: number
}

export interface NewsArticle {
  id: string
  title: string
  link: string
  source: string
  publishedAt: string
  summary?: string
  /** Which tag produced this row; empty for Top news */
  tag?: string
  imageUrl?: string
}

export type NewsCollapsed = {
  top: boolean
  tagged: boolean
}

export interface NewsState {
  version: 1
  tags: NewsTag[]
  collapsed: NewsCollapsed
  lastRefreshAt?: string
  /** ISO cutoff — articles newer than this count as unread (syncs via workspace extras). */
  seenAt?: string
  /** ISO time when tags / collapsed / seenAt last changed (LWW on sync). */
  prefsUpdatedAt?: string
  /** Tombstones for removed tags so union merge does not resurrect them across devices. */
  deletedTags?: Array<{ tag: string; deletedAt: string }>
}

export const DEFAULT_NEWS_TAGS: Omit<NewsTag, 'id' | 'createdAt' | 'sortOrder'>[] = [
  { tag: 'BTC', label: 'Bitcoin' },
  { tag: 'ETH', label: 'Ethereum' },
  { tag: 'ADA', label: 'Cardano' },
  { tag: 'TSLA', label: 'Tesla' },
  { tag: 'MSTR', label: 'Strategy (MSTR)' },
]

export const DEFAULT_NEWS_COLLAPSED: NewsCollapsed = {
  top: false,
  tagged: false,
}

export function normalizeNewsTag(tag: string): string {
  return tag.trim().toUpperCase().replace(/^\$/, '').replace(/\s+/g, '')
}

export function newNewsTagId(tag: string): string {
  const key = normalizeNewsTag(tag).toLowerCase()
  return `news_${key}_${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyNewsState(): NewsState {
  const now = new Date().toISOString()
  return {
    version: 1,
    tags: DEFAULT_NEWS_TAGS.map((t, i) => ({
      ...t,
      tag: normalizeNewsTag(t.tag),
      id: `news_${normalizeNewsTag(t.tag).toLowerCase()}`,
      createdAt: now,
      sortOrder: i,
    })),
    collapsed: { ...DEFAULT_NEWS_COLLAPSED },
  }
}
