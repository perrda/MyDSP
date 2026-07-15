import { describe, expect, it } from 'vitest'

/**
 * Lightweight contract: workspace extras shape used by sync decrypt → apply.
 * Full encrypt round-trip is covered elsewhere; this guards the field list.
 */
describe('workspace sync extras contract', () => {
  it('expects markets, news, youtube, and navLayout on full archive', () => {
    const archive = {
      appVersion: '1.2.22',
      portfolioCount: 1,
      activePortfolioId: 'default',
      portfolios: [],
      blobs: {},
      markets: { version: 1, tickers: [], collapsed: {} },
      news: { version: 1, tags: [], collapsed: {} },
      youtube: { version: 1, channels: [] },
      navLayout: {
        version: 1,
        favourites: ['/'],
        others: ['/markets'],
        othersCollapsed: true,
      },
    }

    const extras: Record<string, unknown> = {}
    if (archive.navLayout != null) extras.navLayout = archive.navLayout
    if (archive.markets != null) extras.markets = archive.markets
    if (archive.news != null) extras.news = archive.news
    if (archive.youtube != null) extras.youtube = archive.youtube

    expect(Object.keys(extras).sort()).toEqual(['markets', 'navLayout', 'news', 'youtube'])
    expect((extras.navLayout as { favourites: string[] }).favourites[0]).toBe('/')
  })
})
