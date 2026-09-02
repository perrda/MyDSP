import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { applyWorkspaceExtrasFromPreview, saveSyncConfig } from '../services/sync/syncService'
import { importNewsArticlesFromBackup, loadNewsArticlesCache } from '../storage/newsStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.156 leftover headlines replace + Mini go-live', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.164')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.164')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.164',
      '1.2.163',
      '1.2.162',
      '1.2.161',
      '1.2.160',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.156\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/newsArticles/)
    expect(section).toMatch(/go-live\.sh/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Leftover News headlines \+ Mini go-live \(v1\.2\.156\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.164/)
    expect(read('../../scripts/go-live.sh')).toMatch(/git clone https:\/\/github.com\/perrda\/MyDSP.git/)
    expect(read('../../scripts/go-live.sh')).toMatch(/npm run deploy/)
    expect(read('../../scripts/go-live.sh')).toMatch(/npx wrangler whoami/)
    expect(read('../../scripts/go-live.sh')).toMatch(/Live service worker/)
    expect(read('../../DEPLOY.md')).toMatch(/scripts\/go-live\.sh/)
    expect(read('../services/sync/syncService.ts')).toMatch(/importNewsArticlesFromBackup/)
    expect(read('../services/sync/syncService.ts')).toMatch(/replace: replaceLeftovers/)
  })

  it('first extras apply drops leftover News headlines', async () => {
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    importNewsArticlesFromBackup({
      top: [{ id: 'leftover', title: 'Leftover only', link: 'https://example.com/l', source: 'x', publishedAt: '2026-01-01' }],
      byTag: { LEFTO: [{ id: 't', title: 'Leftover tag', link: 'https://example.com/t', source: 'x', publishedAt: '2026-01-01' }] },
      fetchedAt: '2026-09-01T10:00:00.000Z',
    })
    expect(loadNewsArticlesCache().top.map((a) => a.id)).toEqual(['leftover'])

    await applyWorkspaceExtrasFromPreview({
      source: 'pull',
      portfolios: [],
      registryPortfolios: [],
      conflicts: [],
      workspaceExtras: {
        newsArticles: {
          top: [{ id: 'mini', title: 'From Mini', link: 'https://example.com/m', source: 'm', publishedAt: '2026-09-01' }],
          byTag: { BTC: [] },
          fetchedAt: '2026-09-01T16:00:00.000Z',
        },
      },
    })
    const cache = loadNewsArticlesCache()
    expect(cache.top.map((a) => a.id)).toEqual(['mini'])
    expect(cache.byTag.LEFTO).toBeUndefined()
  })
})
