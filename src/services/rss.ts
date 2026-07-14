/** Shared RSS / Atom fetch + parse (News + YouTube). */

async function fetchText(url: string, timeoutMs = 10000): Promise<string | null> {
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

/** Public CORS proxies — raced in parallel; first usable response wins. */
function proxyUrlsFor(target: string): string[] {
  return [
    `https://proxy.cors.sh/${target}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    `https://corsproxy.io/?${encodeURIComponent(target)}`,
  ]
}

/**
 * Fetch a remote URL from the browser: try direct, then race CORS proxies.
 * Returns the first body that passes `isAcceptable` (default: non-empty).
 */
export async function fetchRemoteText(
  url: string,
  opts?: {
    timeoutMs?: number
    proxyTimeoutMs?: number
    isAcceptable?: (text: string) => boolean
  },
): Promise<string | null> {
  const timeoutMs = opts?.timeoutMs ?? 8000
  const proxyTimeoutMs = opts?.proxyTimeoutMs ?? 10000
  const isAcceptable = opts?.isAcceptable ?? ((t: string) => t.trim().length > 0)

  const direct = await fetchText(url, timeoutMs)
  if (direct && isAcceptable(direct)) return direct

  const proxies = proxyUrlsFor(url)
  const result = await Promise.any(
    proxies.map(async (proxy) => {
      const text = await fetchText(proxy, proxyTimeoutMs)
      if (text && isAcceptable(text)) return text
      throw new Error('proxy miss')
    }),
  ).catch(() => null)

  return result ?? (direct && isAcceptable(direct) ? direct : null)
}

function looksLikeFeed(text: string): boolean {
  return text.includes('<rss') || text.includes('<feed') || text.includes('<?xml')
}

/** Direct first (often CORS-ok for Google/Yahoo RSS), then public proxies. */
export async function fetchFeedXml(url: string): Promise<string | null> {
  return fetchRemoteText(url, {
    timeoutMs: 8000,
    proxyTimeoutMs: 12000,
    isAcceptable: looksLikeFeed,
  })
}

export interface ParsedFeedItem {
  id: string
  title: string
  link: string
  publishedAt: string
  summary?: string
  source?: string
  imageUrl?: string
  author?: string
}

function textContent(el: Element | null): string {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim()
}

function attr(el: Element | null, name: string): string {
  return el?.getAttribute(name)?.trim() || ''
}

function firstChild(parent: Element, names: string[]): Element | null {
  for (const name of names) {
    const hit = parent.getElementsByTagName(name)[0]
    if (hit) return hit
    const local = name.includes(':') ? name.split(':')[1] : name
    const byLocal = [...parent.children].find(
      (c) => c.localName === local || c.tagName.toLowerCase() === name.toLowerCase(),
    )
    if (byLocal) return byLocal
  }
  return null
}

function parseRfcDate(raw: string): string {
  if (!raw) return new Date().toISOString()
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/** Parse RSS 2.0 or Atom XML into a flat item list. */
export function parseFeedXml(xml: string): ParsedFeedItem[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return []

  const channelTitle = textContent(doc.querySelector('channel > title') || doc.querySelector('feed > title'))

  const rssItems = [...doc.querySelectorAll('channel > item')]
  if (rssItems.length > 0) {
    return rssItems.map((item, i) => {
      const title = textContent(firstChild(item, ['title']))
      const link =
        textContent(firstChild(item, ['link'])) ||
        attr(firstChild(item, ['link']), 'href') ||
        textContent(firstChild(item, ['guid']))
      const publishedAt = parseRfcDate(
        textContent(firstChild(item, ['pubDate', 'published', 'updated', 'dc:date'])),
      )
      const summary = textContent(firstChild(item, ['description', 'summary', 'content:encoded', 'content']))
      const source =
        textContent(firstChild(item, ['source'])) ||
        textContent(item.querySelector('source')) ||
        channelTitle
      const enclosure = item.querySelector('enclosure[type^="image"], media\\:thumbnail, media\\:content')
      const imageUrl =
        attr(enclosure, 'url') ||
        attr(item.querySelector('media\\:thumbnail'), 'url') ||
        undefined
      const id = textContent(firstChild(item, ['guid'])) || link || `${title}-${i}`
      return {
        id,
        title: title || 'Untitled',
        link,
        publishedAt,
        summary: summary ? summary.replace(/<[^>]+>/g, '').slice(0, 280) : undefined,
        source: source || undefined,
        imageUrl,
      }
    })
  }

  const atomEntries = [...doc.querySelectorAll('entry')]
  return atomEntries.map((entry, i) => {
    const title = textContent(firstChild(entry, ['title']))
    const linkEl =
      entry.querySelector('link[rel="alternate"]') ||
      entry.querySelector('link[href]') ||
      firstChild(entry, ['link'])
    const link = attr(linkEl, 'href') || textContent(linkEl)
    const publishedAt = parseRfcDate(
      textContent(firstChild(entry, ['published', 'updated'])),
    )
    const summary = textContent(firstChild(entry, ['summary', 'content']))
    const author = textContent(entry.querySelector('author > name')) || channelTitle
    const media = entry.querySelector('media\\:group media\\:thumbnail, media\\:thumbnail')
    const imageUrl = attr(media, 'url') || undefined
    const id = textContent(firstChild(entry, ['id'])) || link || `${title}-${i}`
    return {
      id,
      title: title || 'Untitled',
      link,
      publishedAt,
      summary: summary ? summary.replace(/<[^>]+>/g, '').slice(0, 280) : undefined,
      source: author || undefined,
      imageUrl,
      author,
    }
  })
}
