import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Favourites phase-2 holdings/media follow-ups', () => {
  it('keeps YouTube Shorts filtering in place', () => {
    const domain = readFileSync(resolve(__dirname, '../domain/youtube.ts'), 'utf8')
    const feeds = readFileSync(resolve(__dirname, '../services/youtubeFeeds.ts'), 'utf8')
    const page = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(domain).toMatch(/filterOutYoutubeShorts/)
    expect(feeds).toMatch(/filterOutYoutubeShorts/)
    expect(page).toMatch(/YouTube Shorts are filtered out/)
  })

  it('exposes phase-2 holding and media test IDs', () => {
    const holding = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    const youtube = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')

    expect(holding).toMatch(/data-testid="equity-dividend-schedule"/)
    expect(holding).toMatch(/data-testid="equity-tax-lots"/)
    expect(equities).toMatch(/data-testid="equity-broker-import"/)
    expect(holding).toMatch(/data-testid="crypto-transfers"/)
    expect(holding).toMatch(/data-testid="crypto-staking"/)
    expect(crypto).toMatch(/data-testid="crypto-exchange-stub"/)
    expect(news).toMatch(/data-testid="news-saved"/)
    expect(news).toMatch(/data-testid="news-holding-impact"/)
    expect(youtube).toMatch(/data-testid="youtube-embed"/)
    expect(youtube).toMatch(/data-testid="youtube-folders"/)
    expect(youtube).toMatch(/data-testid="youtube-relevance"/)
  })
})
