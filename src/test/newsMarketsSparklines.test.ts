import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  geckoDaysForTimeframe,
  isMarketTimeframe,
  MARKET_TIMEFRAMES,
  yahooChartParamsForTimeframe,
} from '../domain/marketTimeframe'
import { changePctFromSeries } from '../domain/sparklineSeries'

describe('news + markets UX fixes (v1.2.69)', () => {
  it('quote Worker allowlists News RSS hosts (Yahoo + Google)', () => {
    const worker = readFileSync(resolve('quote-endpoint/worker.js'), 'utf8')
    expect(worker).toMatch(/news\.google\.com/)
    expect(worker).toMatch(/feeds\.finance\.yahoo\.com/)
    expect(worker).toMatch(/application\/rss\+xml/)
    expect(worker).toMatch(/no-store/)
  })

  it('RSS fetch prefers quote Worker proxy', () => {
    const rss = readFileSync(resolve('src/services/rss.ts'), 'utf8')
    expect(rss).toMatch(/quoteProxyUrl/)
    expect(rss).toMatch(/looksLikeFeed/)
  })

  it('news feeds target Top 10 + 10 per tag via Yahoo (Google soft fallback)', () => {
    const feeds = readFileSync(resolve('src/services/newsFeeds.ts'), 'utf8')
    expect(feeds).toMatch(/fetchTopFinancialNews\(limit = 10\)/)
    expect(feeds).toMatch(/fetchNewsForTag\(tag: NewsTag, limit = 10\)/)
    expect(feeds).toMatch(/feeds\.finance\.yahoo\.com/)
    expect(feeds).toMatch(/news\.google\.com/)
    expect(feeds).toMatch(/TOP_YAHOO_SYMBOLS/)
  })

  it('News page uses media refresh + last-good cache', () => {
    const page = readFileSync(resolve('src/pages/NewsPage.tsx'), 'utf8')
    expect(page).toMatch(/loadNewsArticlesCache/)
    expect(page).toMatch(/refreshNewsFeeds/)
    expect(page).toMatch(/mydsp-news-articles/)
    expect(page).toMatch(/NEWS_PAGE = 10/)
  })

  it('Markets heatmap density is removed; timeframe toolbar wired', () => {
    const markets = readFileSync(resolve('src/pages/MarketsPage.tsx'), 'utf8')
    expect(markets).not.toMatch(/markets-heat-grid/)
    expect(markets).not.toMatch(/heatColorForChangePct/)
    expect(markets).toMatch(/MARKET_TIMEFRAMES/)
    expect(markets).toMatch(/setMarketsTimeframe/)
    expect(markets).toMatch(/timeframe/)
  })

  it('USD formatters use currencyDisplay code', () => {
    const fmt = readFileSync(resolve('src/utils/format.ts'), 'utf8')
    expect(fmt).toMatch(/currencyDisplay: code === 'USD' \? 'code'/)
    expect(fmt).toMatch(/currencyDisplay: currencyCode === 'USD' \? 'code'/)
  })

  it('timeframe helpers map Yahoo/Gecko windows', () => {
    expect(MARKET_TIMEFRAMES).toEqual(['24H', '1W', '1M', '12M', 'YTD', 'ALL'])
    expect(yahooChartParamsForTimeframe('YTD').range).toBe('ytd')
    expect(yahooChartParamsForTimeframe('ALL').range).toBe('max')
    expect(geckoDaysForTimeframe('ALL')).toBe('max')
    expect(isMarketTimeframe('1M')).toBe(true)
    expect(yahooChartParamsForTimeframe('24H').interval).toBe('5m')
    expect(yahooChartParamsForTimeframe('12M').interval).toBe('1d')
    expect(geckoDaysForTimeframe('1W')).toBe(7)
    expect(geckoDaysForTimeframe('12M')).toBe(365)
  })

  it('% change and sparkline share the same series math', () => {
    const spark = [100, 102, 105]
    expect(changePctFromSeries(spark)).toBeCloseTo(5, 5)
  })

  it('package version is tip', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
    expect(pkg.version).toBe('1.2.100')
  })
})
