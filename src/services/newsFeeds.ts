/** Financial news feeds — Google News RSS via quote Worker (same path as prices/FX). */

import type { NewsArticle, NewsTag } from '../domain/news'
import { fetchFeedXml, parseFeedXml } from './rss'

function googleNewsSearchRss(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`
}

function googleNewsTopicRss(): string {
  // Broad business / markets topic feed (always has items)
  return 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-GB&gl=GB&ceid=GB:en'
}

function hashId(parts: string[]): string {
  return parts.join('|').slice(0, 180)
}

function toArticle(
  item: ReturnType<typeof parseFeedXml>[number],
  tag?: string,
): NewsArticle | null {
  if (!item.title || !item.link) return null
  return {
    id: hashId([tag || 'top', item.id || item.link]),
    title: item.title,
    link: item.link,
    source: item.source || (tag ? `News · ${tag}` : 'Google News'),
    publishedAt: item.publishedAt,
    summary: item.summary,
    tag,
    imageUrl: item.imageUrl,
  }
}

function collectFromXml(
  xml: string | null,
  limit: number,
  seen: Set<string>,
  out: NewsArticle[],
  tag?: string,
): void {
  if (!xml) return
  for (const item of parseFeedXml(xml)) {
    const article = toArticle(item, tag)
    if (!article) continue
    const key = article.link || article.title
    if (seen.has(key)) continue
    seen.add(key)
    out.push(article)
    if (out.length >= limit) return
  }
}

/** Top markets / finance headlines — always aim for `limit` (default 10). */
export async function fetchTopFinancialNews(limit = 10): Promise<NewsArticle[]> {
  const queries = [
    'financial markets when:1d',
    'stocks OR crypto OR forex when:1d',
    'bitcoin OR ethereum OR stocks when:1d',
  ]
  const seen = new Set<string>()
  const out: NewsArticle[] = []

  // Topic feed first (usually denser), then search queries
  collectFromXml(await fetchFeedXml(googleNewsTopicRss()), limit, seen, out)
  if (out.length >= limit) return out.slice(0, limit)

  for (const q of queries) {
    collectFromXml(await fetchFeedXml(googleNewsSearchRss(q)), limit, seen, out)
    if (out.length >= limit) return out.slice(0, limit)
  }
  return out.slice(0, limit)
}

/** News for a single ticker / topic tag via Google News search. */
export async function fetchNewsForTag(tag: NewsTag, limit = 10): Promise<NewsArticle[]> {
  const sym = tag.tag.toUpperCase()
  const label = (tag.label || sym).trim()
  const isLikelyEquity =
    /^[A-Z]{1,5}(\.[A-Z]+)?$/.test(sym) &&
    !['BTC', 'ETH', 'ADA', 'SOL', 'XRP', 'DOGE', 'DOT', 'LINK', 'AVAX', 'USDC', 'NIGHT', 'TRUMP'].includes(sym)

  const queries = isLikelyEquity
    ? [`${sym} stock OR shares when:7d`, `${label} OR ${sym} when:7d`]
    : [`${label} OR ${sym} when:7d`, `${sym} crypto OR bitcoin when:7d`]

  const seen = new Set<string>()
  const out: NewsArticle[] = []

  for (const q of queries) {
    collectFromXml(await fetchFeedXml(googleNewsSearchRss(q)), limit, seen, out, sym)
    if (out.length >= limit) return out.slice(0, limit)
  }
  return out.slice(0, limit)
}

/** Fetch tagged news for all watchlist tags (limited concurrency). */
export async function fetchTaggedNews(
  tags: NewsTag[],
  perTag = 10,
): Promise<Record<string, NewsArticle[]>> {
  const result: Record<string, NewsArticle[]> = {}
  let next = 0
  const concurrency = 3
  async function worker() {
    while (next < tags.length) {
      const i = next++
      const tag = tags[i]
      try {
        result[tag.id] = await fetchNewsForTag(tag, perTag)
      } catch {
        result[tag.id] = []
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tags.length || 1) }, () => worker()))
  return result
}
