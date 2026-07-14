/** Shared RSS / Atom fetch + parse (News + YouTube). */

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

/** Direct first (often CORS-ok for Google/Yahoo/YouTube RSS), then public proxies. */
export async function fetchFeedXml(url: string): Promise<string | null> {
  const direct = await fetchText(url)
  if (direct && (direct.includes('<rss') || direct.includes('<feed') || direct.includes('<?xml'))) {
    return direct
  }
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ]
  for (const proxy of proxies) {
    const text = await fetchText(proxy, 14000)
    if (text && (text.includes('<rss') || text.includes('<feed') || text.includes('<?xml'))) {
      return text
    }
  }
  return direct
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
