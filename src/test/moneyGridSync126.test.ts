import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import { MONEY_DIRECTORY, MONEY_DOORS } from '../domain/hubPages'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  chooseFirstSyncAction,
  isEmptyOrSampleBook,
  localBookIsSourceOfTruth,
} from '../services/sync/localBook'
import {
  DEFAULT_SYNC_REMOTE_URL,
  loadSyncConfig,
  resolveSyncRemoteUrl,
} from '../services/sync/syncService'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.126 Money directory + one-button Sync', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.156')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.156')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.156',
      '1.2.155',
      '1.2.154',
      '1.2.153',
      '1.2.152',
    ])
    const moneyTip = RELEASE_NOTES.find((e) => e.version === '1.2.126')
    expect(moneyTip?.bullets.map((b) => (typeof b === 'string' ? b : b.text)).join(' ')).toMatch(
      /12 tiles|passphrase \+ Sync|1\.2\.125/,
    )
  })

  it('restores the 1.2.121 twelve tiles with the same names, copy, and routes', () => {
    expect(MONEY_DIRECTORY.map((d) => [d.label, d.detail, d.to])).toEqual([
      ['Spending', 'Ledger and categories', '/spending'],
      ['Budgets', 'Monthly limits', '/budgets'],
      ['Recurring', 'Bills and income', '/recurring'],
      ['Liabilities', 'Debt and cards', '/liabilities'],
      ['Tax', 'Capital gains pack', '/tax'],
      ['Journal', 'Trades and notes', '/journal'],
      ['Crypto', 'Holdings', '/crypto'],
      ['Equities', 'Holdings', '/equities'],
      ['Commodities', 'Paper book', '/commodities'],
      ['Staking', 'Yield positions', '/staking'],
      ['Import', 'CSV and opening balances', '/import'],
      ['Merchant rules', 'Spending aliases', '/rules'],
    ])
    const money = read('../pages/MoneyPage.tsx')
    expect(money).toMatch(/money-directory/)
    expect(money).toMatch(/MONEY_DIRECTORY/)
    expect(money).toMatch(/money-cockpit/)
    expect(money).toMatch(/MONEY_DOORS/)
    expect(money).not.toMatch(/overflow-hidden/)
    expect(MONEY_DOORS.map((d) => d.label)).toEqual(['Spend', 'Holdings', 'Tax', 'Import'])
    const app = read('../App.tsx')
    for (const path of [
      'spending',
      'budgets',
      'recurring',
      'liabilities',
      'tax',
      'journal',
      'crypto',
      'equities',
      'commodities',
      'staking',
      'import',
      'rules',
      'cashflow',
      'money',
    ]) {
      expect(app).toMatch(new RegExp(`path="${path}"`))
    }
    const css = read('../index.css')
    expect(css).toMatch(/\.money-directory/)
    expect(css).toMatch(/Never overflow:hidden on this card/)
    expect(css).toMatch(/grid-template-columns:\s*1fr/)
  })

  it('bakes the existing mydsp-sync Worker and hides DIY behind Advanced', () => {
    expect(DEFAULT_SYNC_REMOTE_URL).toBe('https://mydsp-sync.dave-perry.workers.dev')
    expect(resolveSyncRemoteUrl('')).toMatch(/^https:\/\/mydsp-sync\.dave-perry\.workers\.dev\/?$/)
    expect(resolveSyncRemoteUrl('https://custom.example/sync')).toMatch(/custom\.example/)
    const settings = read('../pages/SettingsPage.tsx')
    expect(settings).toMatch(/data-testid="sync-simple"/)
    expect(settings).toMatch(/data-testid="sync-one-button"/)
    expect(settings).toMatch(/data-testid="sync-advanced"/)
    expect(settings).toMatch(/runOneButtonSync/)
    expect(settings).toMatch(/DEFAULT_SYNC_REMOTE_URL/)
    expect(settings).toMatch(/First-time Cloudflare setup/)
    expect(settings).toMatch(/sync-setup-url-card/)
    expect(settings).not.toMatch(/SYNC_KEY/)
    expect(read('../services/sync/oneButtonSync.ts')).not.toMatch(/SYNC_KEY/)
    expect(read('../domain/releaseNotes.ts')).not.toMatch(/SYNC_KEY/)
    const cfg = loadSyncConfig()
    expect(cfg.autoResolveConflicts).toBe(false)
  })

  it('first Sync pushes a real book and pulls empty or sample books', () => {
    expect(isEmptyOrSampleBook(createEmptyPortfolio())).toBe(true)
    expect(isEmptyOrSampleBook(createSamplePortfolio())).toBe(true)
    const real = createEmptyPortfolio()
    real.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 1.25, price: 0, cost: 10_000 }]
    expect(isEmptyOrSampleBook(real)).toBe(false)
    expect(chooseFirstSyncAction({ localHasBook: true, alreadySynced: false })).toBe('pull')
    expect(chooseFirstSyncAction({ localHasBook: false, alreadySynced: false })).toBe('pull')
    expect(chooseFirstSyncAction({ localHasBook: true, alreadySynced: true })).toBe('pull')
    expect(chooseFirstSyncAction({ localHasBook: false, alreadySynced: true })).toBe('pull')
    expect(
      chooseFirstSyncAction({ localHasBook: true, alreadySynced: false, isBookDevice: true }),
    ).toBe('push')
    expect(
      chooseFirstSyncAction({ localHasBook: true, alreadySynced: false, isBookDevice: false }),
    ).toBe('pull')
    const one = read('../services/sync/oneButtonSync.ts')
    expect(one).toMatch(/chooseFirstSyncAction/)
    expect(one).toMatch(/Pushed this book/)
    expect(typeof localBookIsSourceOfTruth).toBe('function')
    const auto = read('../services/sync/autoSyncService.ts')
    expect(auto).toMatch(/autoResolveConflicts === true/)
  })

  it('orange lock stays #F7931A', () => {
    const css = read('../index.css')
    expect(css).toMatch(/--accent:\s*#F7931A/)
    expect(css).toMatch(/\.btn-primary \{[\s\S]*background-color:\s*#F7931A/)
    expect(read('../../CHANGELOG.md')).toMatch(/## \[1\.2\.126\][\s\S]*#F7931A/)
  })
})
