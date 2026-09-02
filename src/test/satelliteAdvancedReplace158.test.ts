import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEmptyPortfolio } from '../domain/defaults'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import type { PortfolioData } from '../domain/types'
import { mergePortfolio } from '../services/sync/merge'
import {
  applyMergePreview,
  applyReviewedPull,
  isDraftWorkerPreview,
  saveSyncConfig,
  type MergePreview,
} from '../services/sync/syncService'
import { listPortfolios, loadPortfolio, savePortfolioImmediate } from '../storage/portfolioStore'

vi.mock('../services/marketsQuotes', () => ({
  refreshLiveMarksAfterUnlock: vi.fn(async () => undefined),
}))

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function leftoverDavid(): PortfolioData {
  const data = createEmptyPortfolio()
  data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.04, price: 0, cost: 2811 }]
  return data
}

function miniDavid(): PortfolioData {
  const data = createEmptyPortfolio()
  data.crypto = [
    { id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 12.5, price: 85000, cost: 400_000 },
    { id: 2, symbol: 'ETH', name: 'Ethereum', qty: 40, price: 2500, cost: 80_000 },
  ]
  return data
}

function seedLeftoverLocal(): void {
  localStorage.setItem(
    'fcc_portfolios',
    JSON.stringify([
      { id: 'default', name: 'David', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'extra_leftover', name: 'Leftover Extra', createdAt: '2024-01-01T00:00:00.000Z' },
    ]),
  )
  localStorage.setItem('fcc_active_portfolio', 'default')
  savePortfolioImmediate(leftoverDavid(), 'default')
  savePortfolioImmediate(createEmptyPortfolio(), 'extra_leftover')
}

function replacePreview(): MergePreview {
  const local = leftoverDavid()
  const remote = miniDavid()
  return {
    source: 'pull',
    portfolios: [
      {
        portfolioId: 'default',
        isNew: false,
        local,
        remote,
        conflicts: [
          {
            portfolioId: 'default',
            collection: 'crypto',
            id: 1,
            localLabel: 'BTC',
            remoteLabel: 'BTC',
          },
        ],
      },
    ],
    registryPortfolios: [
      { id: 'default', name: 'David', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'extra_leftover', name: 'Leftover Extra', createdAt: '2024-01-01T00:00:00.000Z' },
    ],
    remoteRegistry: [{ id: 'default', name: 'David', createdAt: '2026-01-01T00:00:00.000Z' }],
    activePortfolioId: 'default',
    conflicts: [
      {
        portfolioId: 'default',
        collection: 'crypto',
        id: 1,
        localLabel: 'BTC',
        remoteLabel: 'BTC',
      },
    ],
  }
}

describe('MyDSP 1.2.158 satellite Advanced Pull replaces leftover holdings', () => {
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
    const section = changelog.match(/## \[1\.2\.158\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/applyReviewedPull/)
    expect(section).toMatch(/applyRemoteAsBook/)
    expect(section).toMatch(/applyMergePreview/)
    expect(section).toMatch(/Rotate/)
    expect(section).toMatch(/go-live\.sh/)
    expect(section).toMatch(/Draft previews/)
    expect(section).toMatch(/pushSync/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Satellite Advanced Pull REPLACE \(v1\.2\.158\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.164/)
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/export async function applyReviewedPull/)
    expect(sync).toMatch(/applyRemoteAsBook\(preview\)/)
    expect(sync).toMatch(/refreshLiveMarksAfterUnlock/)
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/applyReviewedPull/)
    expect(settings).not.toMatch(/applyMergePreview/)
    expect(settings).toMatch(/Pull book from Mini/)
    expect(settings).toMatch(/Rotate the passphrase on the Mini/)
    expect(settings).toMatch(/sync-draft-preview-warn/)
    expect(settings).toMatch(/isDraftWorkerPreview/)
    expect(sync).toMatch(/isDraftWorkerPreview\(\)/)
    const rotateAt = settings.indexOf('Re-encrypt & push')
    expect(rotateAt).toBeGreaterThan(0)
    expect(settings.slice(settings.lastIndexOf('if (!isBookDevice(syncCfg))', rotateAt), rotateAt)).toMatch(
      /isBookDevice\(syncCfg\)/,
    )
    expect(read('../components/SyncConflictSheet.tsx')).toMatch(/applyReviewedPull/)
    expect(read('../../.cursor/rules/media-cross-device-sync.mdc')).toMatch(/applyReviewedPull/)
    expect(read('../../.cursor/rules/media-cross-device-sync.mdc')).toMatch(/Rotate passphrase/)
    expect(read('../../.cursor/rules/media-cross-device-sync.mdc')).toMatch(/Draft Worker previews/)
    const live = read('../../scripts/go-live.sh')
    expect(live).toMatch(/npx wrangler whoami/)
    expect(live).toMatch(/Live service worker/)
    expect(live).toMatch(/mydsp-v/)
  })

  it('satellite Advanced apply drops leftover DAVID qty; union would have kept 0.04', async () => {
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    seedLeftoverLocal()
    const merged = mergePortfolio(leftoverDavid(), miniDavid())
    expect(merged.crypto.find((c) => c.id === 1)?.qty).toBe(0.04)

    await applyReviewedPull(replacePreview(), {})
    const david = loadPortfolio('default')
    expect(david.crypto.find((c) => c.id === 1)?.qty).toBe(12.5)
    expect(david.crypto.find((c) => c.id === 1)?.cost).toBe(400_000)
    expect(listPortfolios().map((p) => p.name)).not.toContain('Leftover Extra')
  })

  it('draft cursor-*-mydspv1 hosts must not push; Live and main preview may', () => {
    expect(
      isDraftWorkerPreview('cursor-satellite-advanced-replace-6f30-mydspv1.dave-perry.workers.dev'),
    ).toBe(true)
    expect(
      isDraftWorkerPreview('cursor-mini-absorb-extras-6f30-mydsp.dave-perry.workers.dev'),
    ).toBe(true)
    expect(isDraftWorkerPreview('047722a6-mydspv1.dave-perry.workers.dev')).toBe(true)
    expect(isDraftWorkerPreview('main-mydspv1.dave-perry.workers.dev')).toBe(false)
    expect(isDraftWorkerPreview('mydspv1.dave-perry.workers.dev')).toBe(false)
    expect(isDraftWorkerPreview('localhost')).toBe(false)
    expect(isDraftWorkerPreview('mydsp-sync.dave-perry.workers.dev')).toBe(false)
  })

  it('Mini book Advanced apply still unions via applyMergePreview', async () => {
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: false,
      thisDeviceIsTheBook: true,
    })
    seedLeftoverLocal()
    await applyReviewedPull(replacePreview(), {})
    const david = loadPortfolio('default')
    expect(david.crypto.find((c) => c.id === 1)?.qty).toBe(0.04)
    const viaMerge = await applyMergePreview(replacePreview(), {})
    expect(viaMerge.merged).toBeGreaterThan(0)
  })
})
