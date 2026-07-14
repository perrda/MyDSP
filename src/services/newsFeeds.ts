/** Financial news feeds — Google News (top) + Yahoo Finance (tickers). */

import type { NewsArticle, NewsTag } from '../domain/news'
import { fetchFeedXml, parseFeedXml } from './rss'

function yahooNewsRss(symbol: string): string {
  return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`
}

function googleNewsSearchRss(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`
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
    source: item.source || (tag ? `Yahoo · ${tag}` : 'Google News'),
    publishedAt: item.publishedAt,
    summary: item.summary,
    tag,
    imageUrl: item.imageUrl,
  }
}

/** Top markets / finance headlines for the day. */
export async function fetchTopFinancialNews(limit = 20): Promise<NewsArticle[]> {
  const queries = [
    'financial markets when:1d',
    'stocks OR crypto OR forex when:1d',
  ]
  const seen = new Set<string>()
  const out: NewsArticle[] = []

  for (const q of queries) {
    const xml = await fetchFeedXml(googleNewsSearchRss(q))
    if (!xml) continue
    for (const item of parseFeedXml(xml)) {
      const article = toArticle(item)
      if (!article) continue
      const key = article.link || article.title
      if (seen.has(key)) continue
      seen.add(key)
      out.push(article)
      if (out.length >= limit) return out
    }
  }
  return out
}

/** News for a single ticker / topic tag. */
export async function fetchNewsForTag(tag: NewsTag, limit = 8): Promise<NewsArticle[]> {
  const sym = tag.tag.toUpperCase()
  // Equities → Yahoo headline RSS; crypto / anything else → Google News search
  const isLikelyEquity = /^[A-Z]{1,5}(\.[A-Z]+)?$/.test(sym) && !['BTC', 'ETH', 'ADA', 'SOL', 'XRP', 'DOGE', 'DOT', 'LINK', 'AVAX', 'USDC', 'NIGHT'].includes(sym)

  const urls = isLikelyEquity
    ? [yahooNewsRss(sym), googleNewsSearchRss(`${sym} stock OR shares when:7d`)]
    : [
        googleNewsSearchRss(`${tag.label || sym} OR ${sym} when:7d`),
        yahooNewsRss(sym),
      ]

  const seen = new Set<string>()
  const out: NewsArticle[] = []

  for (const url of urls) {
    const xml = await fetchFeedXml(url)
    if (!xml) continue
    for (const item of parseFeedXml(xml)) {
      const article = toArticle(item, sym)
      if (!article) continue
      const key = article.link || article.title
      if (seen.has(key)) continue
      seen.add(key)
      out.push(article)
      if (out.length >= limit) return out
    }
  }
  return out
}

/** Fetch tagged news for all watchlist tags (limited concurrency). */
export async function fetchTaggedNews(
  tags: NewsTag[],
  perTag = 6,
): Promise<Record<string, NewsArticle[]>> {
  const result: Record<string, NewsArticle[]> = {}
  let next = 0
  const concurrency = 2
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
