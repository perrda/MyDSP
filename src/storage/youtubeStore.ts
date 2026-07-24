/** Persist YouTube favourite channels (workspace-level). */

import {
  createEmptyYoutubeState,
  MAX_YOUTUBE_CHANNELS,
  newYoutubeChannelId,
  type YoutubeChannel,
  type YoutubeState,
  type YoutubeVideo,
} from '../domain/youtube'

const KEY = 'mydsp_youtube_v1'
/** Legacy page-local key — migrated into YoutubeState.seenAt on first load. */
const LEGACY_SEEN_KEY = 'mydsp_youtube_seen_at'

function notifyChanged(opts?: { fromSync?: boolean }): void {
  try {
    window.dispatchEvent(new CustomEvent('mydsp-youtube-changed'))
  } catch {
    /* ignore */
  }
  if (!opts?.fromSync) {
    void import('../services/sync/workspaceDirty').then((m) =>
      m.markWorkspaceChangedForSync(),
    )
  }
}

function readRaw(): YoutubeState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as YoutubeState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.channels)) return null
    return parsed
  } catch {
    return null
  }
}

function writeState(state: YoutubeState, opts?: { silent?: boolean; fromSync?: boolean }): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  if (!opts?.silent) notifyChanged({ fromSync: opts?.fromSync })
}

function normalizeChannel(c: YoutubeChannel, i: number): YoutubeChannel {
  return {
    ...c,
    sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : i,
  }
}

function migrateLegacySeenAt(state: YoutubeState): YoutubeState {
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

export function loadYoutubeState(): YoutubeState {
  const existing = readRaw()
  if (existing) {
    const normalized = migrateLegacySeenAt({
      ...existing,
      version: 1,
      channels: existing.channels.map(normalizeChannel),
      seenAt: typeof existing.seenAt === 'string' ? existing.seenAt : undefined,
    })
    if (normalized.seenAt && !existing.seenAt) {
      writeState(normalized, { silent: true })
    }
    return normalized
  }
  // Silent seed — unread badges call load on every open; never mark sync dirty
  // or a fresh web/mobile device can push empty favourites over the cloud.
  const seeded = migrateLegacySeenAt(createEmptyYoutubeState())
  writeState(seeded, { silent: true })
  return seeded
}

function touchYoutubePrefs(state: YoutubeState): void {
  state.prefsUpdatedAt = new Date().toISOString()
}

export function saveYoutubeState(state: YoutubeState, opts?: { touchPrefs?: boolean }): void {
  if (opts?.touchPrefs !== false) touchYoutubePrefs(state)
  writeState({
    ...state,
    version: 1,
    channels: state.channels.map(normalizeChannel),
  })
}

export function listYoutubeChannels(): YoutubeChannel[] {
  return [...loadYoutubeState().channels].sort((a, b) => a.sortOrder - b.sortOrder)
}

function mergeChannelTombstones(
  local: YoutubeState['deletedChannels'],
  remote: YoutubeState['deletedChannels'],
): Array<{ channelId: string; deletedAt: string }> {
  const byId = new Map<string, string>()
  for (const d of [...(local ?? []), ...(remote ?? [])]) {
    if (!d || typeof d.channelId !== 'string' || typeof d.deletedAt !== 'string') continue
    const prev = byId.get(d.channelId)
    if (!prev || Date.parse(d.deletedAt) >= Date.parse(prev)) byId.set(d.channelId, d.deletedAt)
  }
  return [...byId.entries()].map(([channelId, deletedAt]) => ({ channelId, deletedAt }))
}

export function addYoutubeChannel(input: {
  channelId: string
  title: string
  url: string
  thumbnailUrl?: string
}): YoutubeChannel {
  const channelId = input.channelId.trim()
  if (!channelId) throw new Error('Channel id is required.')
  const state = loadYoutubeState()
  if (state.channels.length >= MAX_YOUTUBE_CHANNELS) {
    throw new Error(`You can save up to ${MAX_YOUTUBE_CHANNELS} YouTube channels.`)
  }
  if (state.channels.some((c) => c.channelId === channelId)) {
    throw new Error('This channel is already in your favourites.')
  }
  // Re-adding clears any tombstone so the favourite can sync again.
  state.deletedChannels = (state.deletedChannels ?? []).filter((d) => d.channelId !== channelId)
  const maxOrder = state.channels.reduce((m, c) => Math.max(m, c.sortOrder), -1)
  const row: YoutubeChannel = {
    id: newYoutubeChannelId(channelId),
    channelId,
    title: input.title.trim() || channelId,
    url: input.url.trim() || `https://www.youtube.com/channel/${channelId}`,
    thumbnailUrl: input.thumbnailUrl,
    createdAt: new Date().toISOString(),
    sortOrder: maxOrder + 1,
  }
  state.channels.push(row)
  saveYoutubeState(state)
  return row
}

export function updateYoutubeChannel(
  id: string,
  patch: Partial<Pick<YoutubeChannel, 'title' | 'url' | 'thumbnailUrl'>>,
): YoutubeChannel {
  const state = loadYoutubeState()
  const idx = state.channels.findIndex((c) => c.id === id)
  if (idx < 0) throw new Error('Channel not found.')
  const current = state.channels[idx]
  const updated: YoutubeChannel = {
    ...current,
    title: patch.title != null ? patch.title.trim() || current.title : current.title,
    url: patch.url != null ? patch.url.trim() || current.url : current.url,
    thumbnailUrl:
      patch.thumbnailUrl !== undefined ? patch.thumbnailUrl : current.thumbnailUrl,
  }
  state.channels[idx] = updated
  saveYoutubeState(state)
  return updated
}

export function removeYoutubeChannel(id: string): void {
  const state = loadYoutubeState()
  const removed = state.channels.find((c) => c.id === id)
  state.channels = state.channels.filter((c) => c.id !== id)
  if (removed?.channelId) {
    const deletedAt = new Date().toISOString()
    const rest = (state.deletedChannels ?? []).filter((d) => d.channelId !== removed.channelId)
    state.deletedChannels = [...rest, { channelId: removed.channelId, deletedAt }]
  }
  saveYoutubeState(state)
}

export function reorderYoutubeChannels(orderedIds: string[]): void {
  const state = loadYoutubeState()
  const byId = new Map(state.channels.map((c) => [c.id, c]))
  const next: YoutubeChannel[] = []
  for (const id of orderedIds) {
    const c = byId.get(id)
    if (c) {
      next.push(c)
      byId.delete(id)
    }
  }
  for (const c of byId.values()) next.push(c)
  state.channels = next.map((c, i) => ({ ...c, sortOrder: i }))
  saveYoutubeState(state)
}

export function setYoutubeLastRefresh(iso: string): void {
  const state = loadYoutubeState()
  state.lastRefreshAt = iso
  writeState(state, { silent: true })
}

export function getYoutubeSeenAt(): string {
  return loadYoutubeState().seenAt ?? ''
}

export function setYoutubeSeenAt(iso: string): void {
  const state = loadYoutubeState()
  state.seenAt = iso
  saveYoutubeState(state)
  try {
    localStorage.setItem(LEGACY_SEEN_KEY, iso)
  } catch {
    /* ignore */
  }
}

export function exportYoutubeForBackup(): YoutubeState {
  return loadYoutubeState()
}

export function importYoutubeFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as YoutubeState
  if (parsed.version !== 1 || !Array.isArray(parsed.channels)) return
  const local = loadYoutubeState()
  const remotePrefsAt = Date.parse(parsed.prefsUpdatedAt || '') || 0
  const localPrefsAt = Date.parse(local.prefsUpdatedAt || '') || 0

  const deletedChannels = mergeChannelTombstones(local.deletedChannels, parsed.deletedChannels)
  const tombstoned = new Set(deletedChannels.map((d) => d.channelId))

  // Union channels by channelId (keep local row when both have it).
  // Skip tombstoned ids so removals sync across web / tablet / mobile.
  const byId = new Map<string, YoutubeChannel>()
  for (const c of local.channels.map(normalizeChannel)) {
    if (tombstoned.has(c.channelId)) continue
    byId.set(c.channelId, c)
  }
  let nextOrder = local.channels.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1
  for (const c of parsed.channels.map(normalizeChannel)) {
    if (tombstoned.has(c.channelId)) continue
    if (byId.has(c.channelId)) continue
    byId.set(c.channelId, { ...c, sortOrder: nextOrder++ })
  }
  const channels = [...byId.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, MAX_YOUTUBE_CHANNELS)

  const remoteSeenAt = typeof parsed.seenAt === 'string' ? parsed.seenAt : undefined
  const localSeenAt = typeof local.seenAt === 'string' ? local.seenAt : undefined
  const remoteSeenMs = Date.parse(remoteSeenAt || '') || 0
  const localSeenMs = Date.parse(localSeenAt || '') || 0
  const seenAt =
    remoteSeenMs >= localSeenMs
      ? remoteSeenAt || localSeenAt
      : localSeenAt || remoteSeenAt

  writeState(
    {
      version: 1,
      channels,
      deletedChannels,
      lastRefreshAt:
        remotePrefsAt >= localPrefsAt
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

const VIDEOS_KEY = 'mydsp_youtube_videos_v1'

export interface YoutubeVideosCache {
  videos: YoutubeVideo[]
  fetchedAt?: string
}

export function loadYoutubeVideosCache(): YoutubeVideosCache {
  try {
    const raw = localStorage.getItem(VIDEOS_KEY)
    if (!raw) return { videos: [] }
    const parsed = JSON.parse(raw) as YoutubeVideosCache
    return {
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : undefined,
    }
  } catch {
    return { videos: [] }
  }
}

export function saveYoutubeVideosCache(
  cache: YoutubeVideosCache,
  opts?: { markDirty?: boolean },
): void {
  try {
    localStorage.setItem(
      VIDEOS_KEY,
      JSON.stringify({
        videos: (cache.videos || []).slice(0, 60),
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

export function exportYoutubeVideosForBackup(): YoutubeVideosCache {
  return loadYoutubeVideosCache()
}

export function importYoutubeVideosFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const remote = raw as YoutubeVideosCache
  const local = loadYoutubeVideosCache()
  const remoteAt = Date.parse(remote.fetchedAt || '') || 0
  const localAt = Date.parse(local.fetchedAt || '') || 0
  const preferRemote = remoteAt >= localAt && remoteAt > 0
  const videos = preferRemote
    ? Array.isArray(remote.videos) && remote.videos.length > 0
      ? remote.videos
      : local.videos
    : local.videos.length > 0
      ? local.videos
      : Array.isArray(remote.videos)
        ? remote.videos
        : []
  saveYoutubeVideosCache({
    videos: videos.slice(0, 60),
    fetchedAt: preferRemote
      ? remote.fetchedAt || local.fetchedAt
      : local.fetchedAt || remote.fetchedAt,
  })
  try {
    window.dispatchEvent(new CustomEvent('mydsp-youtube-videos'))
  } catch {
    /* ignore */
  }
}

/** Unread count from last-good cache (works before live refresh). */
export function youtubeUnreadFromCache(): number {
  const seenAt = getYoutubeSeenAt()
  const { videos } = loadYoutubeVideosCache()
  return videos.filter((v) => !seenAt || v.publishedAt > seenAt).length
}
