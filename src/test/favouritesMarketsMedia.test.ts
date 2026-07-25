import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('favourites excellence — Markets / News / YouTube fixes', () => {
  it('Markets has session search, guarded quote modal, and removable row alerts', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/data-testid="markets-search"/)
    expect(page).toMatch(/const \[marketSearch, setMarketSearch\] = useState\(''\)/)
    expect(page).toMatch(/marketSearchQuery/)
    expect(page).toMatch(/haystack\.includes\(marketSearchQuery\)/)
    expect(page).toMatch(/useMediaQuery\('\(min-width: 900px\)'\)/)
    expect(page).toMatch(/open=\{Boolean\(quoteDetail\) && !masterDetailActive\}/)
    expect(page).toMatch(/markets-price-alert-badge/)
    expect(page).toMatch(/Remove alert/)
    expect(page).toMatch(/savePriceAlertThresholds\(next\)/)

    const alerts = readFileSync(resolve(__dirname, '../domain/priceAlerts.ts'), 'utf8')
    expect(alerts).toMatch(/if \(!Array\.isArray\(parsed\)\) return DEFAULT_THRESHOLDS/)
    expect(alerts).toMatch(/JSON\.stringify\(cleaned\)/)
  })

  it('News matches the 900px master-detail breakpoint and undoes mark-read', () => {
    const page = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(page).toMatch(/news-row-phone-link/)
    expect(page).toMatch(/news-row-detail-button/)
    expect(page).toMatch(/const seen = new Set<string>\(\)/)
    expect(page).toMatch(/const key = a\.link \|\| a\.id/)
    expect(page).toMatch(/title: 'News marked read'/)
    expect(page).toMatch(/label: 'Undo'/)
    expect(page).toMatch(/header Refresh/)
    expect(page).toMatch(/news-empty-from-owned/)
  })

  it('YouTube hides no-channel cache, uses 900px detail rows, and allows URL repair', () => {
    const page = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(page).toMatch(/cachedWithoutChannels/)
    expect(page).toMatch(/const displayedVideos = useMemo/)
    expect(page).toMatch(/if \(cachedWithoutChannels\) return \[\]/)
    expect(page).toMatch(/Cached from last sync — add a channel/)
    expect(page).toMatch(/youtube-row-phone-link/)
    expect(page).toMatch(/youtube-row-detail-button/)
    expect(page).toMatch(/title: 'YouTube marked read'/)
    expect(page).toMatch(/label: 'Undo'/)
    expect(page).toMatch(/disabled=\{resolving\}/)
    expect(page).not.toMatch(/disabled=\{Boolean\(editing\) \|\| resolving\}/)
    expect(page).toMatch(/selectedVideo\.description/)
  })

  it('CSS pins media master-detail controls to the real two-pane breakpoint', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/@media \(min-width: 900px\)/)
    expect(css).toMatch(/\.news-row-phone-link,\n\s*\.youtube-row-phone-link \{\n\s*display: none;/)
    expect(css).toMatch(/\.news-row-detail-button,\n\s*\.youtube-row-detail-button \{\n\s*display: flex;/)
    expect(css).toMatch(/\.markets-master-detail-panel,\n\s*\.youtube-master-detail-panel,\n\s*\.news-master-detail-panel \{\n\s*display: block;/)
    expect(css).toMatch(/\.news-sticky-filters,\n\s*\.markets-sticky-filters/)
    expect(css).toMatch(/\.markets-search-row/)
  })
})
