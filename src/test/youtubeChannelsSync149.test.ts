import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.149 YouTube channels unlock-and-pull across devices', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.149')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.149')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.149',
      '1.2.147',
      '1.2.146',
      '1.2.145',
      '1.2.144',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.149\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/YouTube/)
    expect(section).toMatch(/passphrase/)
    expect(section).toMatch(/Mini/)
    expect(section).toMatch(/runOneButtonSync/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/YouTube channels unlock-and-pull \(v1\.2\.149\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.149/)
  })

  it('YouTube and News unlock banners pull extras without Settings-only', () => {
    const yt = read('../pages/YouTubePage.tsx')
    expect(yt).toMatch(/UnlockSyncMediaBanner/)
    expect(yt).toMatch(/These channels are only on this Mac/)
    expect(yt).not.toMatch(/Unlock in Settings → Sync/)
    const news = read('../pages/NewsPage.tsx')
    expect(news).toMatch(/UnlockSyncMediaBanner/)
    const banner = read('../components/UnlockSyncMediaBanner.tsx')
    expect(banner).toMatch(/runOneButtonSync/)
    expect(banner).toMatch(/mydsp-youtube-changed/)
    expect(banner).toMatch(/mydsp-news-changed/)
    expect(banner).toMatch(/mydsp-markets-changed/)
  })
})
