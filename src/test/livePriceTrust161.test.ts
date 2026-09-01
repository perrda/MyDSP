import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { mergeMarketQuotes } from '../domain/marketQuotesCache'
import type { MarketQuote } from '../domain/markets'
import {
  displayAutoSyncStatus,
  noteSuccessfulCloudContact,
  stopAutoSync,
} from '../services/sync/autoSyncService'
import {
  DEFAULT_SYNC_REMOTE_URL,
  loadSyncConfig,
  saveSyncConfig,
} from '../services/sync/syncService'
import { clearSessionSyncPassphrase } from '../services/sync/sessionPassphrase'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function quote(
  partial: Partial<MarketQuote> & Pick<MarketQuote, 'symbol' | 'kind' | 'last'>,
): MarketQuote {
  return {
    changeAbs: 0,
    changePct: 0,
    sparkline: [],
    unit: 'GBP',
    decimals: 2,
    source: 'yahoo',
    updatedAt: '2026-09-01T17:00:00.000Z',
    ...partial,
  }
}

describe('MyDSP 1.2.161 live-price trust leftover', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.161')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.161')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.161',
      '1.2.160',
      '1.2.159',
      '1.2.158',
      '1.2.157',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.161\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Finnhub-only 429/)
    expect(section).toMatch(/live hit/)
    expect(section).toMatch(/SYNC ERROR|Sync error/)
    expect(section).toMatch(/[Ll]ast-good/)
    expect(section).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(section).not.toMatch(/wrangler deploy/)
    expect(section).toMatch(/draft only|Draft only/)
    expect(read('../../ROADMAP.md')).toMatch(/[Ll]ive-price trust leftover \(v1\.2\.161\)/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.161/)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
  })

  it('does not revert Mini absorb extras (1.2.160) or live-marks refetch', () => {
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/absorbRemoteWorkspaceExtrasBeforePush/)
    expect(sync.indexOf('export async function absorbRemoteWorkspaceExtrasBeforePush')).toBeLessThan(
      sync.indexOf('export async function pushSync'),
    )
    const auto = read('../services/sync/autoSyncService.ts')
    expect(auto).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(auto).toMatch(/noteSuccessfulCloudContact/)
    expect(read('../services/sync/oneButtonSync.ts')).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(read('../services/marketsQuotes.ts')).toMatch(/refreshLiveMarksAfterUnlock/)
    expect(read('../../.cursor/rules/media-cross-device-sync.mdc')).toMatch(
      /refreshLiveMarksAfterUnlock/,
    )
  })

  it('header Refresh still samples listed providers; missing Finnhub key is not OK', () => {
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).toMatch(/pingAllMarketsProviders/)
    expect(shell).toMatch(/sampledThisTick/)
    const health = read('../services/marketsProviderHealth.ts')
    expect(health).toMatch(/isMarketsBookDegraded/)
    expect(health).toMatch(/hasLiveListedProviderHit/)
    expect(health).toMatch(/Finnhub-only 429/)
    expect(health).toMatch(/if \(!finnhubKey\)/)
    expect(health).toMatch(/outcomes\.finnhub = 'skip'/)
    const prices = read('../services/prices.ts')
    expect(prices).toMatch(/skipped: true, detail: '429 rate limit \/ quota'/)
    expect(read('../components/QuoteFailoverBanner.tsx')).toMatch(/isMarketsBookDegraded\(3\)/)
    expect(read('../components/QuoteFailoverBanner.tsx')).toMatch(/mydsp-markets-quotes/)
  })

  it('keeps Mini-as-book, orange lock, and fluid-fit bar', () => {
    expect(read('../services/sync/localBook.ts')).toMatch(
      /thisDeviceIsTheBook|localBookIsSourceOfTruth/,
    )
    expect(read('../index.css')).toMatch(/#F7931A/)
    expect(read('../test/fluidFit133.test.ts')).toMatch(/fluid-fit|fluidFit/)
    expect(read('../components/layout/ToolbarControls.tsx')).toMatch(/toolbar-refresh/)
    const section = read('../../CHANGELOG.md').match(/## \[1\.2\.161\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).not.toMatch(/fluid-fit/)
  })
})

describe('last-good only when no live hit, and labelled', () => {
  it('keeps last-good labelled stale when live returns none', () => {
    const previous = new Map([
      ['t_btc', quote({ symbol: 'BTC', kind: 'crypto', last: 50_000, source: 'yahoo' })],
    ])
    const next = new Map([
      ['t_btc', quote({ symbol: 'BTC', kind: 'crypto', last: 0, source: 'none' })],
    ])
    const merged = mergeMarketQuotes(previous, next)
    expect(merged.get('t_btc')?.last).toBe(50_000)
    expect(merged.get('t_btc')?.source).toBe('stale:yahoo')
  })

  it('prefers this-tick live over last-good', () => {
    const previous = new Map([
      ['t_btc', quote({ symbol: 'BTC', kind: 'crypto', last: 50_000, source: 'stale:yahoo' })],
    ])
    const next = new Map([
      ['t_btc', quote({ symbol: 'BTC', kind: 'crypto', last: 51_200, source: 'yahoo' })],
    ])
    const merged = mergeMarketQuotes(previous, next)
    expect(merged.get('t_btc')?.last).toBe(51_200)
    expect(merged.get('t_btc')?.source).toBe('yahoo')
  })
})

describe('stale SYNC ERROR clears on live 200', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
    stopAutoSync()
  })

  afterEach(() => {
    clearSessionSyncPassphrase()
    stopAutoSync()
  })

  it('noteSuccessfulCloudContact clears lastSyncError and shows Synced', () => {
    saveSyncConfig({
      remoteUrl: DEFAULT_SYNC_REMOTE_URL,
      enabled: true,
      lastSyncAt: '2026-09-01T17:07:25.912Z',
      lastSyncError: 'Remote check failed (401)',
    })
    noteSuccessfulCloudContact({ lastAt: '2026-09-01T18:07:26.000Z', emitIdle: true })
    expect(loadSyncConfig().lastSyncError).toBeUndefined()
    expect(loadSyncConfig().lastSyncAt).toBe('2026-09-01T18:07:26.000Z')
  })

  it('displayAutoSyncStatus heals a stale error after lastSyncError is cleared', () => {
    saveSyncConfig({
      remoteUrl: DEFAULT_SYNC_REMOTE_URL,
      enabled: true,
      lastSyncAt: '2026-09-01T17:07:25.912Z',
      lastSyncError: undefined,
    })
    const healed = displayAutoSyncStatus({
      state: 'error',
      message: 'Remote check failed (401)',
      lastAt: '2026-09-01T17:07:25.912Z',
    })
    expect(healed.state).toBe('idle')
    expect(healed.message).toBe('Synced')
  })

  it('keeps a real current error when lastSyncError is still set', () => {
    saveSyncConfig({
      remoteUrl: DEFAULT_SYNC_REMOTE_URL,
      enabled: true,
      lastSyncAt: '2026-09-01T17:07:25.912Z',
      lastSyncError: 'Remote check failed (401)',
    })
    const shown = displayAutoSyncStatus({
      state: 'error',
      message: 'Remote check failed (401)',
      lastAt: '2026-09-01T17:07:25.912Z',
    })
    expect(shown.state).toBe('error')
  })

  it('boot PUT and GET-200 skip call noteSuccessfulCloudContact', () => {
    const auto = read('../services/sync/autoSyncService.ts')
    const boot = auto.slice(auto.indexOf('export function startAutoSync'))
    expect(boot).toMatch(/noteSuccessfulCloudContact/)
    expect(boot).toMatch(/emitIdle: true/)
    expect(auto).toMatch(/Live GET 200/)
    expect(auto.indexOf('noteSuccessfulCloudContact({ lastAt: cfg.lastSyncAt')).toBeGreaterThan(
      auto.indexOf('meta = await fetchRemoteMeta'),
    )
  })
})
