/** YouTube channel resolve + Atom video feeds (no API key). */

import { parseYoutubeInput, type YoutubeChannel, type YoutubeVideo } from '../domain/youtube'
import { fetchFeedXml, parseFeedXml } from './rss'

function videosFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  const direct = await fetchText(url)
  if (direct && direct.length > 500) return direct
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ]
  for (const p of proxies) {
    const t = await fetchText(p, 14000)
    if (t && t.length > 500) return t
  }
  return direct
}

function extractChannelIdFromHtml(html: string): string | undefined {
  const patterns = [
    /"channelId":"(UC[\w-]{20,})"/,
    /channel_id=(UC[\w-]{20,})/,
    /\/channel\/(UC[\w-]{20,})/,
    /<meta\s+itemprop="channelId"\s+content="(UC[\w-]{20,})"/i,
    /"externalId":"(UC[\w-]{20,})"/,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return undefined
}

function extractChannelTitleFromHtml(html: string): string | undefined {
  const og = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
  if (og?.[1]) return og[1].replace(/ - YouTube$/i, '').trim()
  const t = html.match(/<title>([^<]+)<\/title>/i)
  if (t?.[1]) return t[1].replace(/ - YouTube$/i, '').trim()
  return undefined
}

function extractThumbnailFromHtml(html: string): string | undefined {
  const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
  return og?.[1]
}

/**
 * Resolve a pasted YouTube URL / @handle / UC… id into a channel record.
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
    if (!html) throw new Error('Could not reach YouTube to resolve that handle.')
    channelId = extractChannelIdFromHtml(html)
    title = extractChannelTitleFromHtml(html) || parsed.handle
    thumbnailUrl = extractThumbnailFromHtml(html)
  } else if (channelId) {
    url = `https://www.youtube.com/channel/${channelId}`
    const html = await fetchHtml(url)
    if (html) {
      title = extractChannelTitleFromHtml(html) || channelId
      thumbnailUrl = extractThumbnailFromHtml(html)
    }
  } else if (parsed.url) {
    const html = await fetchHtml(parsed.url)
    if (!html) throw new Error('Could not reach that YouTube URL.')
    channelId = extractChannelIdFromHtml(html)
    title = extractChannelTitleFromHtml(html) || 'YouTube channel'
    thumbnailUrl = extractThumbnailFromHtml(html)
    url = parsed.url
  }

  if (!channelId) {
    throw new Error('Could not find a YouTube channel id. Try the channel’s /channel/UC… URL.')
  }

  // Verify feed exists
  const feed = await fetchFeedXml(videosFeedUrl(channelId))
  if (!feed) {
    throw new Error('Channel found but the video feed is unavailable. Try again later.')
  }
  if (!title) {
    const items = parseFeedXml(feed)
    title = items[0]?.author || items[0]?.source || channelId
  }

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
