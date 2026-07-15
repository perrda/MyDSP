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
}

export interface YoutubeState {
  version: 1
  channels: YoutubeChannel[]
  lastRefreshAt?: string
  /** ISO cutoff — videos newer than this count as unread (syncs via workspace extras). */
  seenAt?: string
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
