/** YouTube channel resolve + Atom video feeds (no API key). */

import { parseYoutubeInput, type YoutubeChannel, type YoutubeVideo } from '../domain/youtube'
import { fetchFeedXml, fetchRemoteText, parseFeedXml } from './rss'

function videosFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
}

async function fetchHtml(url: string): Promise<string | null> {
  return fetchRemoteText(url, {
    timeoutMs: 6000,
    proxyTimeoutMs: 12000,
    isAcceptable: (t) =>
      t.length > 200 &&
      (t.includes('youtube') ||
        t.includes('channelId') ||
        t.includes('externalId') ||
        t.includes('og:url') ||
        t.includes('/channel/UC')),
  })
}

/**
 * Prefer canonical / og:url / externalId / identifier — the first "channelId"
 * in ytInitialData is often a related channel, not the page owner.
 */
export function extractChannelIdFromHtml(html: string): string | undefined {
  const preferred = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[\w-]{20,})["']/i,
    /<link[^>]+href=["']https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[\w-]{20,})["'][^>]+rel=["']canonical["']/i,
    /<meta\s+property=["']og:url["']\s+content=["']https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[\w-]{20,})["']/i,
    /<meta\s+content=["']https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[\w-]{20,})["']\s+property=["']og:url["']/i,
    /<meta\s+itemprop=["']identifier["']\s+content=["'](UC[\w-]{20,})["']/i,
    /<meta\s+content=["'](UC[\w-]{20,})["']\s+itemprop=["']identifier["']/i,
    /<meta\s+itemprop=["']channelId["']\s+content=["'](UC[\w-]{20,})["']/i,
    /"externalId"\s*:\s*"(UC[\w-]{20,})"/,
    /"channelUrl"\s*:\s*"https?:\\\/\\\/(?:www\.)?youtube\.com\\\/channel\\\/(UC[\w-]{20,})"/,
  ]
  for (const re of preferred) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }

  // browseId often equals the page channel; take the most common UC… browseId
  const browseIds = [...html.matchAll(/"browseId"\s*:\s*"(UC[\w-]{20,})"/g)].map((m) => m[1])
  if (browseIds.length > 0) {
    const counts = new Map<string, number>()
    for (const id of browseIds) counts.set(id, (counts.get(id) || 0) + 1)
    let best = browseIds[0]
    let bestN = 0
    for (const [id, n] of counts) {
      if (n > bestN) {
        best = id
        bestN = n
      }
    }
    return best
  }

  const fallback = html.match(/"channelId"\s*:\s*"(UC[\w-]{20,})"/)
  return fallback?.[1]
}

function extractChannelTitleFromHtml(html: string): string | undefined {
  const og = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)
  if (og?.[1]) return og[1].replace(/ - YouTube$/i, '').trim()
  const t = html.match(/<title>([^<]+)<\/title>/i)
  if (t?.[1]) return t[1].replace(/ - YouTube$/i, '').trim()
  return undefined
}

function extractThumbnailFromHtml(html: string): string | undefined {
  const og = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i)
  return og?.[1]
}

/**
 * Resolve a pasted YouTube URL / @handle / UC… id into a channel record.
 * Does not require a YouTube API key. Soft-fails feed verification so the
 * channel can still be saved when Atom is temporarily unreachable.
 */
export async function resolveYoutubeChannel(raw: string): Promise<{
  channelId: string
  title: string
  url: string
  thumbnailUrl?: string
}> {
  const parsed = parseYoutubeInput(raw)
  if (!parsed.url && !parsed.channelId && !parsed.handle) {
    throw new Error('Paste a YouTube channel URL, @handle, or channel id.')
  }

  let channelId = parsed.channelId
  let title = ''
  let thumbnailUrl: string | undefined
  let url = parsed.url

  if (!channelId && parsed.handle) {
    url = `https://www.youtube.com/@${parsed.handle}`
    const html = await fetchHtml(url)
    if (!html) {
      throw new Error(
        'Could not resolve that @handle (YouTube blocked the lookup). Paste the channel’s /channel/UC… URL instead, or try again.',
      )
    }
    channelId = extractChannelIdFromHtml(html)
    title = extractChannelTitleFromHtml(html) || parsed.handle
    thumbnailUrl = extractThumbnailFromHtml(html)
  } else if (channelId) {
    url = `https://www.youtube.com/channel/${channelId}`
    // Title/thumbnail are nice-to-have — don't block add on HTML fetch
    const html = await fetchHtml(url)
    if (html) {
      title = extractChannelTitleFromHtml(html) || channelId
      thumbnailUrl = extractThumbnailFromHtml(html)
    }
  } else if (parsed.url) {
    const html = await fetchHtml(parsed.url)
    if (!html) throw new Error('Could not reach that YouTube URL. Try a /channel/UC… link.')
    channelId = extractChannelIdFromHtml(html)
    title = extractChannelTitleFromHtml(html) || 'YouTube channel'
    thumbnailUrl = extractThumbnailFromHtml(html)
    url = parsed.url
  }

  if (!channelId) {
    throw new Error('Could not find a YouTube channel id. Open the channel → Share → copy link, or paste the /channel/UC… URL.')
  }

  // Soft-verify feed; still save the channel if Atom is temporarily blocked
  const feed = await fetchFeedXml(videosFeedUrl(channelId))
  if (feed && !title) {
    const items = parseFeedXml(feed)
    title = items[0]?.author || items[0]?.source || channelId
  }

  if (!title) title = channelId

  return { channelId, title, url, thumbnailUrl }
}

/** Latest videos for one channel (Atom feed). */
export async function fetchChannelVideos(
  channel: YoutubeChannel,
  limit = 8,
): Promise<YoutubeVideo[]> {
  const xml = await fetchFeedXml(videosFeedUrl(channel.channelId))
  if (!xml) return []
  const items = parseFeedXml(xml).slice(0, limit)
  return items.map((item) => {
    const videoIdMatch = item.link.match(/[?&]v=([\w-]+)/) || item.id.match(/video:([\w-]+)/)
    const videoId = videoIdMatch?.[1]
    const thumbnailUrl =
      item.imageUrl ||
      (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined)
    return {
      id: item.id || item.link,
      channelId: channel.channelId,
      channelTitle: channel.title,
      title: item.title,
      link: item.link.startsWith('http')
        ? item.link
        : videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : item.link,
      publishedAt: item.publishedAt,
      thumbnailUrl,
      description: item.summary,
    }
  })
}

/** Aggregate latest videos across favourite channels, newest first. */
export async function fetchFavouriteVideos(
  channels: YoutubeChannel[],
  perChannel = 5,
  maxTotal = 40,
): Promise<YoutubeVideo[]> {
  const all: YoutubeVideo[] = []
  let next = 0
  const concurrency = 2
  async function worker() {
    while (next < channels.length) {
      const i = next++
      const ch = channels[i]
      try {
        const vids = await fetchChannelVideos(ch, perChannel)
        all.push(...vids)
      } catch {
        /* skip channel */
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, channels.length || 1) }, () => worker()),
  )
  return all
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, maxTotal)
}
