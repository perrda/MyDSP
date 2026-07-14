/** Persist YouTube favourite channels (workspace-level). */

import {
  createEmptyYoutubeState,
  MAX_YOUTUBE_CHANNELS,
  newYoutubeChannelId,
  type YoutubeChannel,
  type YoutubeState,
} from '../domain/youtube'

const KEY = 'mydsp_youtube_v1'

function notifyChanged(): void {
  void import('../services/sync/autoSyncService')
    .then((m) => m.markLocalDataChanged())
    .catch(() => {
      /* sync may be unavailable */
    })
  try {
    window.dispatchEvent(new CustomEvent('mydsp-youtube-changed'))
  } catch {
    /* ignore */
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

function writeState(state: YoutubeState, opts?: { silent?: boolean }): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  if (!opts?.silent) notifyChanged()
}

function normalizeChannel(c: YoutubeChannel, i: number): YoutubeChannel {
  return {
    ...c,
    sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : i,
  }
}

export function loadYoutubeState(): YoutubeState {
  const existing = readRaw()
  if (existing) {
    return {
      ...existing,
      version: 1,
      channels: existing.channels.map(normalizeChannel),
    }
  }
  const seeded = createEmptyYoutubeState()
  writeState(seeded)
  return seeded
}

export function saveYoutubeState(state: YoutubeState): void {
  writeState({
    ...state,
    version: 1,
    channels: state.channels.map(normalizeChannel),
  })
}

export function listYoutubeChannels(): YoutubeChannel[] {
  return [...loadYoutubeState().channels].sort((a, b) => a.sortOrder - b.sortOrder)
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
  state.channels = state.channels.filter((c) => c.id !== id)
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

export function exportYoutubeForBackup(): YoutubeState {
  return loadYoutubeState()
}

export function importYoutubeFromBackup(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const parsed = raw as YoutubeState
  if (parsed.version !== 1 || !Array.isArray(parsed.channels)) return
  const channels = parsed.channels.map(normalizeChannel).slice(0, MAX_YOUTUBE_CHANNELS)
  saveYoutubeState({
    version: 1,
    channels,
    lastRefreshAt: parsed.lastRefreshAt,
  })
}
