import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  mergeQuotesForSync,
  tagQuoteFromSync,
  isSyncedRemoteQuote,
} from '../domain/marketQuotesSync'
import { commodityYahooFallbacks } from '../domain/commodities'
import type { MarketQuote } from '../domain/markets'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

function quote(
  partial: Partial<MarketQuote> & Pick<MarketQuote, 'last' | 'updatedAt' | 'source'>,
): MarketQuote {
  return {
    symbol: 'X',
    kind: 'commodity',
    changeAbs: 0,
    changePct: 1.2,
    sparkline: [1, 2, 3],
    unit: 'GBP',
    decimals: 2,
    ...partial,
  }
}

describe('next25g — sync prices polish tip (1–25 → v1.2.70)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('package + release notes tip is current (1.2.78+)', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.78')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.78')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.78',
      '1.2.77',
      '1.2.76',
      '1.2.75',
      '1.2.74',
    ])
  })

  it('1: fullArchive / sync extras include marketQuotes', () => {
    const backup = readFileSync(resolve(__dirname, '../storage/backupStore.ts'), 'utf8')
    expect(backup).toMatch(/marketQuotes\?: unknown/)
    expect(backup).toMatch(/exportMarketQuotesForBackup\(\)/)
    expect(backup).toMatch(/importMarketQuotesFromBackup/)
    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    expect(sync).toMatch(/marketQuotes\?: unknown/)
    expect(sync).toMatch(/importMarketQuotesFromBackup\(preview\.workspaceExtras\.marketQuotes\)/)
  })

  it('2: Markets refresh marks quote cache dirty for push', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/saveMarketQuotesCache\(merged, \{ markDirty: true \}\)/)
    const prefetch = readFileSync(resolve(__dirname, '../services/marketsQuotes.ts'), 'utf8')
    expect(prefetch).toMatch(/saveMarketQuotesCache\(merged, \{ markDirty: true \}\)/)
  })

  it('3: sync-tagged quotes show From other device', () => {
    const tagged = tagQuoteFromSync(quote({ last: 10, updatedAt: new Date().toISOString(), source: 'yahoo' }))
    expect(isSyncedRemoteQuote(tagged)).toBe(true)
    expect(tagged.source).toBe('sync:yahoo')
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/From other device/)
  })

  it('4: prefsUpdatedAt LWW on Markets import', async () => {
    const store = await import('../storage/marketsStore')
    store.loadMarketsState()
    store.setMarketsDensity('compact')
    const localAt = store.loadMarketsState().prefsUpdatedAt
    expect(localAt).toBeTruthy()

    const remote = {
      ...store.exportMarketsForBackup(),
      density: 'comfortable' as const,
      prefsUpdatedAt: new Date(Date.now() + 60_000).toISOString(),
    }
    store.importMarketsFromBackup(remote)
    expect(store.getMarketsDensity()).toBe('comfortable')
    expect(store.loadMarketsState().prefsUpdatedAt).toBe(remote.prefsUpdatedAt)
  })

  it('5: Sync prices now refreshes + syncNow on desktop and phone thumb bar', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/syncPricesNow/)
    expect(page).toMatch(/Sync prices now/)
    expect(page).toMatch(/await syncNow\(\)/)
    expect(page).toMatch(/thumb-cta-bar/)
    expect(page).toMatch(/Sync prices/)
  })

  it('6: commodity Yahoo fallbacks retry alternate symbols', () => {
    expect(commodityYahooFallbacks('GC=F')).toEqual(
      expect.arrayContaining(['GC=F', 'XAUUSD=X']),
    )
    const prices = readFileSync(resolve(__dirname, '../services/prices.ts'), 'utf8')
    expect(prices).toMatch(/commodityYahooFallbacks/)
    expect(prices).toMatch(/for \(const sym of candidates\)/)
  })

  it('7: per-section refresh + as-of remain wired', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/refreshSection/)
    expect(page).toMatch(/markets-section-asof/)
  })

  it('8: mergeQuotesForSync preserves sparkline/% when winner is thin', () => {
    const local = new Map<string, MarketQuote>([
      [
        't1',
        quote({
          last: 100,
          updatedAt: '2026-07-01T00:00:00.000Z',
          source: 'yahoo',
          changePct: 3.5,
          sparkline: [1, 2, 3, 4],
        }),
      ],
    ])
    const remote = new Map<string, MarketQuote>([
      [
        't1',
        quote({
          last: 101,
          updatedAt: '2026-07-02T00:00:00.000Z',
          source: 'yahoo',
          changePct: 0,
          sparkline: [],
        }),
      ],
    ])
    const merged = mergeQuotesForSync(local, remote)
    const q = merged.get('t1')!
    expect(q.last).toBe(101)
    expect(isSyncedRemoteQuote(q)).toBe(true)
    expect(q.sparkline.length).toBeGreaterThan(1)
    expect(q.changePct).toBe(3.5)
  })

  it('9: provider health maps commodity → yahoo (Settings / banners; Markets chrome stripped)', () => {
    const health = readFileSync(resolve(__dirname, '../services/marketsProviderHealth.ts'), 'utf8')
    expect(health).toMatch(/commodity: 'yahoo'/)
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/getMarketsProviderHealth/)
    expect(page).not.toMatch(/markets-provider-health/)
  })

  it('10: Markets refresh applies quotes to holdings', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/applyLastSyncedQuotesToHoldings/)
  })

  it('11–15: UI polish — tight header, PTR no jump, mixed CTA, drag ghost, long-press Sections', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/Sync prices now — refresh quotes and push to other devices/)
    expect(page).toMatch(/markets-section-mixed/)
    expect(page).toMatch(/Retry unavailable/)
    expect(page).toMatch(/sectionLongPressTimer/)
    expect(page).toMatch(/onTouchMove=\{\(\) => \{/)
    expect(page).toMatch(/markets-list--just-synced/)
    expect(page).toMatch(/markets-row--from-sync/)

    const ptr = readFileSync(resolve(__dirname, '../components/ui/PullToRefresh.tsx'), 'utf8')
    expect(ptr).toMatch(/ptr-content/)
    expect(ptr).not.toMatch(/translateY\(\$\{pullDistance \* 0\.35\}px\)/)

    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/markets-list--just-synced/)
    expect(css).toMatch(/markets-row--from-sync/)
    expect(css).toMatch(/\.reorder-row\.is-dragging/)
  })

  it('16–17: Today movers age gate + cross-device lag chip', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/MOVER_MAX_AGE_MS/)
    expect(dash).toMatch(/today-price-lag-chip/)
    expect(dash).toMatch(/Prices from other device/)
    expect(dash).toMatch(/isSyncedRemoteQuote/)
  })

  it('18: Owned/weight chips still present after watchlist union path', async () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/ownedHoldingWeightByKey/)
    expect(page).toMatch(/markets-owned-chip/)
    const store = await import('../storage/marketsStore')
    const local = store.exportMarketsForBackup()
    store.importMarketsFromBackup({
      ...local,
      tickers: [
        ...local.tickers,
        {
          id: 'remote-only-equity',
          kind: 'equity',
          symbol: 'ZZUNION',
          name: 'Union Test',
          sortOrder: 999,
        },
      ],
    })
    const symbols = store.listMarketTickers('equity').map((t) => t.symbol)
    expect(symbols).toContain('ZZUNION')
  })

  it('19: Compare as-of chips remain', () => {
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/compare-quote-age-chip/)
    expect(compare).toMatch(/as of/)
  })

  it('20: digest honesty — Preview/Share not emailed + fresh movers copy', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/not emailed/)
    expect(dash).toMatch(/No fresh Markets movers/)
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/not emailed/)
  })

  it('21: tip tests cover sync quote merge helpers', () => {
    expect(typeof mergeQuotesForSync).toBe('function')
    expect(typeof tagQuoteFromSync).toBe('function')
  })

  it('22: Playwright smoke asserts commodities + quote cache checks', () => {
    const smoke = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(smoke).toMatch(/Commodities seeded/)
    expect(smoke).toMatch(/Markets quote cache/)
  })

  it('23: /smoke checklist includes commodities + quotes-cache', () => {
    const smokePage = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smokePage).toMatch(/commodities/)
    expect(smokePage).toMatch(/quotes-cache/)
    expect(smokePage).toMatch(/Commodities seeded/)
    expect(smokePage).toMatch(/Markets quote cache/)
  })

  it('24: SYNC_SETUP documents quote cache + what syncs', () => {
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/quote cache/)
    expect(docs).toMatch(/What syncs/)
    expect(docs).toMatch(/Sync prices now/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/From other device/)
  })

  it('25: sync cadence honesty is 4s push / 30s pull in docs + Settings', () => {
    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/PUSH_DEBOUNCE_MS = 4_000/)
    expect(auto).toMatch(/PERIODIC_MS = 30_000/)
    const docs = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(docs).toMatch(/~4s/)
    expect(docs).toMatch(/~30 seconds|every 30/)
    expect(docs).not.toMatch(/~8s after last change/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/~4s/)
    expect(settings).toMatch(/every 30s/)
  })
})
