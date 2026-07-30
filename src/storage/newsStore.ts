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

function normalizeSavedArticleState(state: NewsState): {
  savedArticles: string[]
  savedArticleChanges: NonNullable<NewsState['savedArticleChanges']>
} {
  const changes: NonNullable<NewsState['savedArticleChanges']> = {}
  for (const [key, change] of Object.entries(state.savedArticleChanges ?? {})) {
    const trimmed = key.trim()
    if (
      !trimmed ||
      !change ||
      typeof change.saved !== 'boolean' ||
      typeof change.updatedAt !== 'string'
    ) {
      continue
    }
    changes[trimmed] = { saved: change.saved, updatedAt: change.updatedAt }
  }
  const legacySavedAt =
    typeof state.prefsUpdatedAt === 'string' ? state.prefsUpdatedAt : new Date(0).toISOString()
  for (const key of state.savedArticles ?? []) {
    const trimmed = typeof key === 'string' ? key.trim() : ''
    if (trimmed && !changes[trimmed]) {
      changes[trimmed] = { saved: true, updatedAt: legacySavedAt }
    }
  }
  return {
    savedArticles: Object.entries(changes)
      .filter(([, change]) => change.saved)
      .map(([key]) => key),
    savedArticleChanges: changes,
  }
}

function mergeSavedArticleChanges(
  local: NewsState,
  remote: NewsState,
): NonNullable<NewsState['savedArticleChanges']> {
  const localSaved = normalizeSavedArticleState(local).savedArticleChanges
  const remoteSaved = normalizeSavedArticleState(remote).savedArticleChanges
  const merged: NonNullable<NewsState['savedArticleChanges']> = { ...localSaved }
  for (const [key, incoming] of Object.entries(remoteSaved)) {
    const current = merged[key]
    if (!current) {
      merged[key] = incoming
      continue
    }
    const remoteHasExplicitChange = Boolean(remote.savedArticleChanges?.[key])
    // A legacy savedArticles union must never override a modern explicit unsave tombstone.
    if (!current.saved && incoming.saved && !remoteHasExplicitChange) continue
    const incomingAt = Date.parse(incoming.updatedAt) || 0
    const currentAt = Date.parse(current.updatedAt) || 0
    if (incomingAt > currentAt || (incomingAt === currentAt && !incoming.saved)) {
      merged[key] = incoming
    }
  }
  return merged
}

export function loadNewsState(): NewsState {
  const existing = readRaw()
  if (existing) {
    const saved = normalizeSavedArticleState(existing)
    const normalized: NewsState = migrateLegacySeenAt({
      ...existing,
      version: 1,
      collapsed: {
        top: Boolean(existing.collapsed?.top),
        tagged: Boolean(existing.collapsed?.tagged),
      },
      tags: existing.tags.map(normalizeTag),
      savedArticles: saved.savedArticles,
      savedArticleChanges: saved.savedArticleChanges,
      seenAt: typeof existing.seenAt === 'string' ? existing.seenAt : undefined,
    })
    if (normalized.seenAt && !existing.seenAt) {
      writeState(normalized, { silent: true })
    }
    return normalized
  }
  // Silent seed — unread badges call load on every open; never mark sync dirty
  // or a fresh web/mobile device can push empty tags over the cloud.
  const seeded = migrateLegacySeenAt(createEmptyNewsState())
  writeState(seeded, { silent: true })
  return seeded
}

function touchNewsPrefs(state: NewsState): void {
  state.prefsUpdatedAt = new Date().toISOString()
}

export function saveNewsState(state: NewsState, opts?: { touchPrefs?: boolean }): void {
  if (opts?.touchPrefs !== false) touchNewsPrefs(state)
  const saved = normalizeSavedArticleState(state)
  writeState({
    ...state,
    version: 1,
    tags: state.tags.map(normalizeTag),
    savedArticles: saved.savedArticles,
    savedArticleChanges: saved.savedArticleChanges,
  })
}

export function listNewsTags(): NewsTag[] {
  return [...loadNewsState().tags].sort((a, b) => a.sortOrder - b.sortOrder)
}

function mergeTagTombstones(
  local: NewsState['deletedTags'],
  remote: NewsState['deletedTags'],
): Array<{ tag: string; deletedAt: string }> {
  const byTag = new Map<string, string>()
  for (const d of [...(local ?? []), ...(remote ?? [])]) {
    if (!d || typeof d.tag !== 'string' || typeof d.deletedAt !== 'string') continue
    const key = normalizeNewsTag(d.tag)
    if (!key) continue
    const prev = byTag.get(key)
    if (!prev || Date.parse(d.deletedAt) >= Date.parse(prev)) byTag.set(key, d.deletedAt)
  }
  return [...byTag.entries()].map(([tag, deletedAt]) => ({ tag, deletedAt }))
}

/** Tombstone wins only when delete is strictly after createdAt (same-ms re-add keeps the tag). */
export function newsTombstoneSuppressesTag(
  deletedAt: string,
  createdAt: string | undefined,
): boolean {
  const del = Date.parse(deletedAt) || 0
  const created = Date.parse(createdAt || '') || 0
  if (!del) return false
  if (!created) return true
  return del > created
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
  // Re-adding clears any tombstone so the tag can sync again.
  state.deletedTags = (state.deletedTags ?? []).filter((d) => d.tag !== tag)
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
  const removed = state.tags.find((t) => t.id === id)
  state.tags = state.tags.filter((t) => t.id !== id)
  if (removed?.tag) {
    const deletedAt = new Date().toISOString()
    const rest = (state.deletedTags ?? []).filter((d) => d.tag !== removed.tag)
    state.deletedTags = [...rest, { tag: removed.tag, deletedAt }]
  }
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

export function getSavedNewsArticles(): string[] {
  return loadNewsState().savedArticles ?? []
}

export function isNewsArticleSaved(key: string): boolean {
  if (!key) return false
  return getSavedNewsArticles().includes(key)
}

export function toggleSavedNewsArticle(key: string): boolean {
  const trimmed = key.trim()
  if (!trimmed) return false
  const state = loadNewsState()
  const saved = new Set(state.savedArticles ?? [])
  const nextSaved = !saved.has(trimmed)
  if (nextSaved) saved.add(trimmed)
  else saved.delete(trimmed)
  state.savedArticles = [...saved]
  state.savedArticleChanges = {
    ...(state.savedArticleChanges ?? {}),
    [trimmed]: { saved: nextSaved, updatedAt: new Date().toISOString() },
  }
  saveNewsState(state)
  return nextSaved
}

export function exportNewsForBackup(): NewsState {
  return loadNewsState()
}

export function importNewsFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as NewsState
  if (parsed.version !== 1 || !Array.isArray(parsed.tags)) return
  const local = loadNewsState()
  const remotePrefsAt = Date.parse(parsed.prefsUpdatedAt || '') || 0
  const localPrefsAt = Date.parse(local.prefsUpdatedAt || '') || 0
  const preferRemotePrefs = remotePrefsAt >= localPrefsAt && remotePrefsAt > 0

  const mergedTombstones = mergeTagTombstones(local.deletedTags, parsed.deletedTags)
  const tombstoneAt = new Map(mergedTombstones.map((d) => [d.tag, d.deletedAt]))

  // Union tags by normalized ticker (keep local row when both have it).
  // Tombstones suppress a tag only when deletedAt >= createdAt (re-add wins).
  const byTag = new Map<string, NewsTag>()
  const consider = (t: NewsTag) => {
    const delAt = tombstoneAt.get(t.tag)
    if (delAt && newsTombstoneSuppressesTag(delAt, t.createdAt)) return
    const prev = byTag.get(t.tag)
    if (!prev) {
      byTag.set(t.tag, t)
      return
    }
    const prevMs = Date.parse(prev.createdAt) || 0
    const nextMs = Date.parse(t.createdAt) || 0
    if (nextMs > prevMs) byTag.set(t.tag, { ...t, sortOrder: prev.sortOrder })
  }
  for (const t of local.tags.map(normalizeTag)) consider(t)
  let nextOrder = local.tags.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1
  for (const t of parsed.tags.map(normalizeTag)) {
    if (byTag.has(t.tag)) {
      consider(t)
      continue
    }
    const delAt = tombstoneAt.get(t.tag)
    if (delAt && newsTombstoneSuppressesTag(delAt, t.createdAt)) continue
    byTag.set(t.tag, { ...t, sortOrder: nextOrder++ })
  }

  const deletedTags = mergedTombstones.filter((d) => {
    const kept = byTag.get(d.tag)
    if (kept && !newsTombstoneSuppressesTag(d.deletedAt, kept.createdAt)) return false
    return true
  })

  const remoteSeenAt = typeof parsed.seenAt === 'string' ? parsed.seenAt : undefined
  const localSeenAt = typeof local.seenAt === 'string' ? local.seenAt : undefined
  const remoteSeenMs = Date.parse(remoteSeenAt || '') || 0
  const localSeenMs = Date.parse(localSeenAt || '') || 0
  const seenAt =
    remoteSeenMs >= localSeenMs
      ? remoteSeenAt || localSeenAt
      : localSeenAt || remoteSeenAt
  const savedArticleChanges = mergeSavedArticleChanges(local, parsed)
  const savedArticles = Object.entries(savedArticleChanges)
    .filter(([, change]) => change.saved)
    .map(([key]) => key)

  const collapsedSrc = preferRemotePrefs ? parsed.collapsed : local.collapsed ?? parsed.collapsed
  writeState(
    {
      version: 1,
      tags: [...byTag.values()],
      deletedTags,
      savedArticles,
      savedArticleChanges,
      collapsed: {
        top: Boolean(collapsedSrc?.top),
        tagged: Boolean(collapsedSrc?.tagged),
      },
      lastRefreshAt: preferRemotePrefs
        ? parsed.lastRefreshAt || local.lastRefreshAt
        : local.lastRefreshAt || parsed.lastRefreshAt,
      seenAt,
      prefsUpdatedAt:
        remotePrefsAt >= localPrefsAt
          ? parsed.prefsUpdatedAt || local.prefsUpdatedAt
          : local.prefsUpdatedAt || parsed.prefsUpdatedAt,
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

/** Last-good headlines — survive reloads and failed refreshes (synced via fullArchive). */
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

export function saveNewsArticlesCache(
  cache: NewsArticlesCache,
  opts?: { markDirty?: boolean },
): void {
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
  if (opts?.markDirty) {
    void import('../services/sync/workspaceDirty').then((m) => m.markWorkspaceChangedForSync())
  }
}

/** Last-good headlines for fullArchive / sync. */
export function exportNewsArticlesForBackup(): NewsArticlesCache {
  return loadNewsArticlesCache()
}

/** Unread count from last-good cache (works before live refresh). Dedupes by link. */
export function newsUnreadFromCache(): number {
  const seenAt = getNewsSeenAt()
  const cache = loadNewsArticlesCache()
  const top = cache.top || []
  const tagged = Object.values(cache.byTag || {}).flat()
  const seen = new Set<string>()
  let count = 0
  for (const a of [...top, ...tagged]) {
    const key = a.link || a.id
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (!seenAt || a.publishedAt > seenAt) count++
  }
  return count
}

/** Merge remote last-good headlines (prefer newer fetchedAt; union Top 10). */
export function importNewsArticlesFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as NewsArticlesCache
  const local = loadNewsArticlesCache()
  const remoteAt = Date.parse(remote.fetchedAt || '') || 0
  const localAt = Date.parse(local.fetchedAt || '') || 0
  const preferRemote = remoteAt >= localAt && remoteAt > 0
  const top = preferRemote
    ? (Array.isArray(remote.top) && remote.top.length > 0 ? remote.top : local.top)
    : local.top.length > 0
      ? local.top
      : Array.isArray(remote.top)
        ? remote.top
        : []
  const byTag = { ...(local.byTag || {}) }
  for (const [k, v] of Object.entries(remote.byTag || {})) {
    if (!Array.isArray(v) || v.length === 0) continue
    if (!byTag[k] || byTag[k]!.length === 0 || preferRemote) byTag[k] = v
  }
  saveNewsArticlesCache({
    top: top.slice(0, 30),
    byTag,
    fetchedAt: preferRemote
      ? remote.fetchedAt || local.fetchedAt
      : local.fetchedAt || remote.fetchedAt,
  })
  try {
    window.dispatchEvent(new CustomEvent('mydsp-news-articles'))
  } catch {
    /* ignore */
  }
}

