/** YouTube favourites — channel list + latest video feed. */

export const MAX_YOUTUBE_CHANNELS = 25

export interface YoutubeChannel {
  id: string
  /** Canonical YouTube channel id (UC…) */
  channelId: string
  title: string
  /** Original URL or @handle the user entered */
  url: string
  thumbnailUrl?: string
  createdAt: string
  sortOrder: number
}

export interface YoutubeVideo {
  id: string
  channelId: string
  channelTitle: string
  title: string
  link: string
  publishedAt: string
  thumbnailUrl?: string
  description?: string
  /** From Atom `yt:duration` when present — used to drop sub‑minute Shorts. */
  durationSeconds?: number
}

/**
 * Detect YouTube Shorts from feed metadata (no API key required).
 * Shorts must never appear in favourites lists, unread counts, or upload alerts.
 */
export function isYoutubeShort(
  video: Pick<YoutubeVideo, 'title' | 'link' | 'id' | 'description' | 'durationSeconds'>,
): boolean {
  const link = (video.link || '').toLowerCase()
  const id = (video.id || '').toLowerCase()
  const title = video.title || ''
  const description = video.description || ''

  if (link.includes('/shorts/') || id.includes('/shorts/')) return true
  if (/[?&]feature=shorts\b/i.test(link) || /[?&]feature=shorts\b/i.test(id)) return true
  // Creator hashtag only — do NOT match bare "shorts" (finance = short selling).
  if (/#shorts?\b/i.test(title) || /#shorts?\b/i.test(description)) return true
  // Classic Shorts are ≤60s; YouTube Atom sometimes exposes yt:duration.
  if (
    typeof video.durationSeconds === 'number' &&
    Number.isFinite(video.durationSeconds) &&
    video.durationSeconds > 0 &&
    video.durationSeconds <= 60
  ) {
    return true
  }
  return false
}

/** Drop Shorts; preserve order. */
export function filterOutYoutubeShorts<
  T extends Pick<YoutubeVideo, 'title' | 'link' | 'id' | 'description' | 'durationSeconds'>,
>(videos: T[]): T[] {
  return videos.filter((v) => !isYoutubeShort(v))
}

export interface YoutubeState {
  version: 1
  channels: YoutubeChannel[]
  lastRefreshAt?: string
  /** ISO cutoff — videos newer than this count as unread (syncs via workspace extras). */
  seenAt?: string
  /** ISO time when channels / seenAt last changed (LWW on sync). */
  prefsUpdatedAt?: string
  /** Tombstones for removed favourites so union merge does not resurrect them across devices. */
  deletedChannels?: Array<{ channelId: string; deletedAt: string }>
}

export function newYoutubeChannelId(channelId: string): string {
  return `yt_${channelId}_${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyYoutubeState(): YoutubeState {
  return {
    version: 1,
    channels: [],
  }
}

/** Extract UC… id or @handle from a pasted YouTube URL / bare id / handle. */
export function parseYoutubeInput(raw: string): {
  channelId?: string
  handle?: string
  url: string
} {
  const input = raw.trim()
  if (!input) return { url: '' }

  // Bare channel id
  if (/^UC[\w-]{20,}$/i.test(input)) {
    return { channelId: input, url: `https://www.youtube.com/channel/${input}` }
  }

  // Bare @handle
  if (/^@[\w.-]+$/i.test(input)) {
    return { handle: input.replace(/^@/, ''), url: `https://www.youtube.com/@${input.replace(/^@/, '')}` }
  }

  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`)
    const path = u.pathname

    const channelMatch = path.match(/\/channel\/(UC[\w-]+)/i)
    if (channelMatch) {
      return { channelId: channelMatch[1], url: u.toString() }
    }

    const handleMatch = path.match(/\/@([\w.-]+)/)
    if (handleMatch) {
      return { handle: handleMatch[1], url: u.toString() }
    }

    const userMatch = path.match(/\/(?:c|user)\/([\w.-]+)/)
    if (userMatch) {
      return { handle: userMatch[1], url: u.toString() }
    }
  } catch {
    /* fall through */
  }

  return { url: input }
}
