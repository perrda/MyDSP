import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  bootMarketsTimeframe,
  DEFAULT_MARKET_TF,
  MARKETS_QUOTE_POLL_MS,
} from '../domain/marketTimeframe'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Markets 24H default · 60s poll · edit pencil (v1.2.93)', () => {
  const sessionKey = 'mydsp_markets_tf_session_v1'

  beforeEach(() => {
    try {
      sessionStorage.removeItem(sessionKey)
    } catch {
      /* ignore */
    }
  })

  afterEach(() => {
    try {
      sessionStorage.removeItem(sessionKey)
    } catch {
      /* ignore */
    }
  })

  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.96')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.96')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.96',
      '1.2.95',
      '1.2.94',
      '1.2.93',
      '1.2.92',
    ])
  })

  it('fresh session boots Markets timeframe at 24H even if 12M was persisted', () => {
    expect(DEFAULT_MARKET_TF).toBe('24H')
    expect(bootMarketsTimeframe('12M')).toBe('24H')
    // Second call in same session keeps the (now persisted) choice
    expect(bootMarketsTimeframe('1W')).toBe('1W')
  })

  it('Markets quote poll is 60s and quiet (no refresh loop on data)', () => {
    expect(MARKETS_QUOTE_POLL_MS).toBe(60_000)
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/MARKETS_QUOTE_POLL_MS/)
    expect(page).toMatch(/quiet:\s*true/)
    expect(page).toMatch(/dataRef/)
    expect(page).not.toMatch(/\}, 45_000\)/)
    // refresh deps must not include `data` (that caused constant re-poll)
    expect(page).toMatch(/\[setData, flashRefreshingBanner\]/)
    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(auto).toMatch(/PERIODIC_MS = 60_000/)
  })

  it('Edit pencil icons are full size and not clipped', () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/btn-icon-edit/)
    expect(markets).toMatch(/Pencil size=\{16\}/)
    expect(markets).toMatch(/className="icon-edit"/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.btn-icon-edit/)
    expect(css).toMatch(/svg\.icon-edit/)
    expect(css).toMatch(/overflow:\s*visible/)
    for (const file of ['NewsPage.tsx', 'YouTubePage.tsx']) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).toMatch(/btn-icon-edit/)
      expect(src).toMatch(/Pencil size=\{16\}/)
    }
    const todos = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(todos).toMatch(/btn-icon-edit/)
    expect(todos).toMatch(/Edit2 size=\{16\}/)
  })
})
