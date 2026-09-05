import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  applyWorkspaceExtrasFromPreview,
  loadSyncConfig,
  saveSyncConfig,
} from '../services/sync/syncService'
import {
  satelliteShouldReplaceExtrasOnImport,
} from '../services/sync/satelliteFactorySeed'
import {
  addYoutubeChannel,
  exportYoutubeForBackup,
  listYoutubeChannels,
} from '../storage/youtubeStore'
import { createBlankNewsState } from '../domain/news'
import { createBlankMarketsState } from '../domain/markets'
import { addNewsTag, exportNewsForBackup, loadNewsState, saveNewsState } from '../storage/newsStore'
import { addMarketTicker, listMarketTickers } from '../storage/marketsStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

const satelliteCfg = {
  remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
  enabled: false,
  thisDeviceIsTheBook: false,
}

describe('MyDSP 1.2.153 first extras apply replaces leftovers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.165')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.165')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.165',
      '1.2.164',
      '1.2.163',
      '1.2.162',
      '1.2.161',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.153\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/leftover/)
    expect(section).toMatch(/lastWorkspaceExtrasSyncAt/)
    expect(section).toMatch(/mergeDefaultTickers/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/First satellite extras replace leftovers \(v1\.2\.153\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.164/)
    expect(read('../services/sync/satelliteFactorySeed.ts')).toMatch(
      /satelliteShouldReplaceExtrasOnImport/,
    )
    expect(read('../services/sync/satelliteFactorySeed.ts')).toMatch(
      /satelliteMustNotRefillFactoryTickers/,
    )
    expect(read('../services/sync/syncService.ts')).toMatch(/replace: replaceLeftovers/)
  })

  it('replace flag is satellite + URL + no extras stamp only', () => {
    expect(satelliteShouldReplaceExtrasOnImport()).toBe(false)
    saveSyncConfig({ ...satelliteCfg, thisDeviceIsTheBook: true })
    expect(satelliteShouldReplaceExtrasOnImport()).toBe(false)
    saveSyncConfig(satelliteCfg)
    expect(satelliteShouldReplaceExtrasOnImport()).toBe(true)
    saveSyncConfig({
      ...satelliteCfg,
      lastWorkspaceExtrasSyncAt: '2026-09-01T16:00:00.000Z',
    })
    expect(satelliteShouldReplaceExtrasOnImport()).toBe(false)
  })

  it('Unlock extras drop leftover YouTube / News / Markets; later pull unions', async () => {
    addYoutubeChannel({
      channelId: 'UC_mini',
      title: 'MoneyZG',
      url: 'https://www.youtube.com/@MoneyZG',
    })
    const now = '2026-09-01T12:00:00.000Z'
    saveNewsState({
      ...createBlankNewsState(),
      tags: [{ id: 'news_btc', tag: 'BTC', label: 'Bitcoin', createdAt: now, sortOrder: 0 }],
    })
    const miniMarkets = {
      ...createBlankMarketsState(),
      tickers: [
        {
          id: 'mkt_crypto_btc',
          kind: 'crypto' as const,
          symbol: 'BTC',
          name: 'Bitcoin',
          createdAt: now,
          sortOrder: 0,
        },
      ],
    }
    const extras = {
      youtube: exportYoutubeForBackup(),
      news: exportNewsForBackup(),
      markets: miniMarkets,
    }
    expect(extras.youtube.channels).toHaveLength(1)

    localStorage.clear()
    saveSyncConfig(satelliteCfg)
    addYoutubeChannel({
      channelId: 'UC_macbook',
      title: 'Leftover only on MacBook',
      url: 'https://www.youtube.com/@leftover',
    })
    addNewsTag({ tag: 'LEFTO', label: 'Leftover tag' })
    addMarketTicker({ kind: 'crypto', symbol: 'LEFTO', name: 'Leftover coin' })
    expect(listYoutubeChannels().map((c) => c.title)).toContain('Leftover only on MacBook')

    await applyWorkspaceExtrasFromPreview({
      source: 'pull',
      portfolios: [],
      registryPortfolios: [],
      conflicts: [],
      workspaceExtras: extras,
    })
    expect(listYoutubeChannels().map((c) => c.title)).toEqual(['MoneyZG'])
    expect(loadNewsState().tags.map((t) => t.tag)).toEqual(['BTC'])
    expect(listMarketTickers().map((t) => t.symbol)).toEqual(['BTC'])
    expect(loadSyncConfig().lastWorkspaceExtrasSyncAt).toBeTruthy()
    expect(satelliteShouldReplaceExtrasOnImport()).toBe(false)

    addYoutubeChannel({
      channelId: 'UC_after',
      title: 'Added on MacBook after Unlock',
      url: 'https://www.youtube.com/@after',
    })
    await applyWorkspaceExtrasFromPreview({
      source: 'pull',
      portfolios: [],
      registryPortfolios: [],
      conflicts: [],
      workspaceExtras: extras,
    })
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual([
      'Added on MacBook after Unlock',
      'MoneyZG',
    ])
  })
})
