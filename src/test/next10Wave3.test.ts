import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { makeRuleHref } from '../domain/deepLinks'
import { buildTaxDisposalHref } from '../domain/taxDisposalLink'

const readPage = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next10 wave 3 (v1.2.112)', () => {
  it('0: package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.159')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.159')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.159',
      '1.2.158',
      '1.2.157',
      '1.2.156',
      '1.2.155',
    ])
  })

  it('1: Today cockpit de-dupes bills and shows empty copy', () => {
    const dash = readPage('Dashboard.tsx')
    expect(dash).toMatch(/Nothing scheduled/)
    expect(dash).toMatch(/max:\s*1/)
    expect(dash).toMatch(/stackIncludesBill|todayDailyPlan|showBillsStrip/)
  })

  it('2: Holding trade journal follow-ups', () => {
    const detail = readPage('HoldingDetailPage.tsx')
    expect(detail).toMatch(/Journal buy batches/)
    expect(detail).toMatch(/history=1|Trade history|buildTaxDisposalHref/)
    const toast = readFileSync(resolve(__dirname, '../components/ui/Toast.tsx'), 'utf8')
    expect(toast).toMatch(/actions\?:/)
  })

  it('3: Spending→Rules bridge via makeRuleHref', () => {
    expect(makeRuleHref({ description: 'ACME', category: 'Food' })).toMatch(/\/rules\?/)
    expect(readPage('SpendingPage.tsx')).toMatch(/makeRuleHref/)
    expect(readPage('RulesPage.tsx')).not.toMatch(/className="thumb-cta-bar"/)
  })

  it('4: Optimizer payment deep-link', () => {
    expect(readPage('OptimizerPage.tsx')).toMatch(/payment=1/)
    expect(readPage('OptimizerPage.tsx')).toMatch(/returnTo=optimizer/)
    expect(readPage('LiabilityDetailPage.tsx')).toMatch(/returnTo|payment/)
  })

  it('5: Tax pack honesty + open=1 vs symbol filter', () => {
    expect(buildTaxDisposalHref({
      assetType: 'equity',
      symbol: 'TSLA',
      date: '2026-07-30',
      qty: 1,
      proceeds: 100,
      cost: 50,
    })).toMatch(/open=1/)
    const tax = readPage('TaxPage.tsx')
    expect(tax).toMatch(/§104|FIFO|matching/i)
    expect(tax).toMatch(/settings#display|residency/i)
  })

  it('6: Jobs offer compare supports 3 + compare seed', () => {
    const jobs = readPage('JobsPage.tsx')
    expect(jobs).toMatch(/OfferComparePanel/)
    expect(jobs).toMatch(/compare/)
    expect(readPage('JobDetailPage.tsx')).toMatch(/Compare salary|compare=/)
  })

  it('7: Markets quote trust strip (no Sync button)', () => {
    const markets = readPage('MarketsPage.tsx')
    expect(markets).toMatch(/markets-quote-trust-strip/)
    expect(markets).toMatch(/data-testid="markets-quote-trust-strip"/)
    expect(markets).not.toMatch(/>Sync prices</)
    expect(markets).not.toMatch(/Sync prices now/)
  })

  it('8: Compare local workspace setup (not invite)', () => {
    const compare = readPage('ComparePage.tsx')
    expect(compare).toMatch(/workspaceSetupOpen/)
    expect(compare).toMatch(/compare-workspace-setup/)
    expect(compare).not.toMatch(/inviteOpen/)
  })

  it('9: Notification Center actionable URLs', () => {
    const smart = readFileSync(
      resolve(__dirname, '../components/SmartNotifications.tsx'),
      'utf8',
    )
    expect(smart).toMatch(/\/jobs\/|actionUrl/)
    expect(smart).toMatch(/\/news/)
  })

  it('10: Lower-traffic density uses compact OverflowMenu', () => {
    for (const name of [
      'Goals.tsx',
      'TripsPage.tsx',
      'FamilyPage.tsx',
      'JournalPage.tsx',
      'DocumentsPage.tsx',
    ] as const) {
      const src = readPage(name)
      expect(src).toMatch(/OverflowMenu|PagePrimaryActions/)
      expect(src).not.toMatch(/className="thumb-cta-bar"/)
    }
  })
})
