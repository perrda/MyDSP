/** Persist News watchlist + tags (workspace-level). */

import {
  createEmptyNewsState,
  newNewsTagId,
  normalizeNewsTag,
  type NewsArticle,
  type NewsCollapsed,
  type NewsState,
  type NewsTag,
} from '../domain/news'

const KEY = 'mydsp_news_v1'
/** Legacy page-local key — migrated into NewsState.seenAt on first load. */
const LEGACY_SEEN_KEY = 'mydsp_news_seen_at'

function notifyChanged(opts?: { fromSync?: boolean }): void {
  try {
    window.dispatchEvent(new CustomEvent('mydsp-news-changed'))
  } catch {
    /* ignore */
  }
  if (!opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) =>
      m.markWorkspaceChangedForSync(),
    )
  }
}

function readRaw(): NewsState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as NewsState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tags)) return null
    return parsed
  } catch {
    return null
  }
}

function writeState(state: NewsState, opts?: { silent?: boolean; fromSync?: boolean }): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  if (!opts?.silent) notifyChanged({ fromSync: opts?.fromSync })
}

function normalizeTag(t: NewsTag, i: number): NewsTag {
  return {
    ...t,
    tag: normalizeNewsTag(t.tag),
    sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : i,
  }
}

function migrateLegacySeenAt(state: NewsState): NewsState {
  if (state.seenAt) return state
  try {
    const legacy = localStorage.getItem(LEGACY_SEEN_KEY)
    if (legacy) {
      return { ...state, seenAt: legacy }
    }
  } catch {
    /* ignore */
  }
  return state
}

export function loadNewsState(): NewsState {
  const existing = readRaw()
  if (existing) {
    const normalized: NewsState = migrateLegacySeenAt({
      ...existing,
      version: 1,
      collapsed: {
        top: Boolean(existing.collapsed?.top),
        tagged: Boolean(existing.collapsed?.tagged),
      },
      tags: existing.tags.map(normalizeTag),
      seenAt: typeof existing.seenAt === 'string' ? existing.seenAt : undefined,
    })
    if (normalized.seenAt && !existing.seenAt) {
      writeState(normalized, { silent: true })
    }
    return normalized
  }
  const seeded = migrateLegacySeenAt(createEmptyNewsState())
  writeState(seeded)
  return seeded
}

export function saveNewsState(state: NewsState): void {
  writeState({
    ...state,
    version: 1,
    tags: state.tags.map(normalizeTag),
  })
}

export function listNewsTags(): NewsTag[] {
  return [...loadNewsState().tags].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function addNewsTag(input: { tag: string; label?: string }): NewsTag {
  const tag = normalizeNewsTag(input.tag)
  if (!tag) throw new Error('Tag is required.')
  if (!/^[A-Z0-9.^=-]{1,16}$/.test(tag)) {
    throw new Error('Use a short ticker or topic (e.g. TSLA, BTC, ADA).')
  }
  const state = loadNewsState()
  if (state.tags.some((t) => t.tag === tag)) {
    throw new Error('This tag is already on News.')
  }
  const maxOrder = state.tags.reduce((m, t) => Math.max(m, t.sortOrder), -1)
  const row: NewsTag = {
    id: newNewsTagId(tag),
    tag,
    label: input.label?.trim() || tag,
    createdAt: new Date().toISOString(),
    sortOrder: maxOrder + 1,
  }
  state.tags.push(row)
  saveNewsState(state)
  return row
}

export function updateNewsTag(
  id: string,
  patch: Partial<Pick<NewsTag, 'tag' | 'label'>>,
): NewsTag {
  const state = loadNewsState()
  const idx = state.tags.findIndex((t) => t.id === id)
  if (idx < 0) throw new Error('Tag not found.')
  const current = state.tags[idx]
  const nextTag = patch.tag != null ? normalizeNewsTag(patch.tag) : current.tag
  if (!nextTag) throw new Error('Tag is required.')
  const clash = state.tags.find((t) => t.id !== id && t.tag === nextTag)
  if (clash) throw new Error('This tag is already on News.')
  const updated: NewsTag = {
    ...current,
    tag: nextTag,
    label: patch.label != null ? patch.label.trim() || nextTag : current.label,
  }
  state.tags[idx] = updated
  saveNewsState(state)
  return updated
}

export function removeNewsTag(id: string): void {
  const state = loadNewsState()
  state.tags = state.tags.filter((t) => t.id !== id)
  saveNewsState(state)
}

export function reorderNewsTags(orderedIds: string[]): void {
  const state = loadNewsState()
  const byId = new Map(state.tags.map((t) => [t.id, t]))
  const next: NewsTag[] = []
  for (const id of orderedIds) {
    const t = byId.get(id)
    if (t) {
      next.push(t)
      byId.delete(id)
    }
  }
  for (const t of byId.values()) next.push(t)
  state.tags = next.map((t, i) => ({ ...t, sortOrder: i }))
  saveNewsState(state)
}

export function setNewsCollapsed(section: keyof NewsCollapsed, collapsed: boolean): void {
  const state = loadNewsState()
  state.collapsed = { ...state.collapsed, [section]: collapsed }
  saveNewsState(state)
}

export function setNewsLastRefresh(iso: string): void {
  const state = loadNewsState()
  state.lastRefreshAt = iso
  writeState(state, { silent: true })
}

export function getNewsSeenAt(): string {
  return loadNewsState().seenAt ?? ''
}

export function setNewsSeenAt(iso: string): void {
  const state = loadNewsState()
  state.seenAt = iso
  saveNewsState(state)
  try {
    localStorage.setItem(LEGACY_SEEN_KEY, iso)
  } catch {
    /* ignore */
  }
}

export function exportNewsForBackup(): NewsState {
  return loadNewsState()
}

export function importNewsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as NewsState
  if (parsed.version !== 1 || !Array.isArray(parsed.tags)) return
  writeState(
    {
      version: 1,
      tags: parsed.tags.map(normalizeTag),
      collapsed: {
        top: Boolean(parsed.collapsed?.top),
        tagged: Boolean(parsed.collapsed?.tagged),
      },
      lastRefreshAt: parsed.lastRefreshAt,
      seenAt: typeof parsed.seenAt === 'string' ? parsed.seenAt : undefined,
    },
    { fromSync: true },
  )
}

const ARTICLES_KEY = 'mydsp_news_articles_v1'

export interface NewsArticlesCache {
  top: NewsArticle[]
  byTag: Record<string, NewsArticle[]>
  fetchedAt?: string
}

/** Last-good headlines — survive reloads and failed refreshes (not synced). */
export function loadNewsArticlesCache(): NewsArticlesCache {
  try {
    const raw = localStorage.getItem(ARTICLES_KEY)
    if (!raw) return { top: [], byTag: {} }
    const parsed = JSON.parse(raw) as NewsArticlesCache
    return {
      top: Array.isArray(parsed.top) ? parsed.top : [],
      byTag: parsed.byTag && typeof parsed.byTag === 'object' ? parsed.byTag : {},
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : undefined,
    }
  } catch {
    return { top: [], byTag: {} }
  }
}

export function saveNewsArticlesCache(cache: NewsArticlesCache): void {
  try {
    localStorage.setItem(
      ARTICLES_KEY,
      JSON.stringify({
        top: (cache.top || []).slice(0, 30),
        byTag: Object.fromEntries(
          Object.entries(cache.byTag || {}).map(([k, v]) => [k, (v || []).slice(0, 20)]),
        ),
        fetchedAt: cache.fetchedAt,
      }),
    )
  } catch {
    /* quota */
  }
}

