import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyCryptoCostFallback,
  calcCrypto,
  calcDebtBalance,
  calcNetWorth,
  debtPaydownProgress,
  listUnpricedHoldings,
  unpricedExclusionCopy,
} from '../domain/calc'
import {
  buildCashflowStory,
  cashflowLeftoverSavings,
  ledgerMonthCountCopy,
  settingsMonthlyInflow,
  stablesBreakdown,
} from '../domain/cashflow'
import { createEmptyPortfolio, createSamplePortfolio } from '../domain/defaults'
import { DEFAULT_FIRE, hasExplicitFireInputs, resolveFireSavings } from '../domain/fire'
import { estimateMonthlySurplus } from '../domain/goalProjectedDate'
import { MONEY_DOORS } from '../domain/hubPages'
import { upsertMonthlyPricedSnapshot } from '../domain/history'
import { memberBookLabel } from '../domain/family'
import { PRIMARY_NAV } from '../domain/primaryNav'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { LAUNCH_PATH_OPTIONS } from '../storage/launchPathStore'
import { resolveBottomNavItems } from '../domain/bottomNav'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.123 priced-book pack', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.150')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.150')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.150',
      '1.2.149',
      '1.2.148',
      '1.2.147',
      '1.2.146',
    ])
  })

  it('unpriced holdings are out of NW and the exclusion is said', () => {
    const data = createEmptyPortfolio()
    data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.05, price: 0, cost: 2000 }]
    expect(calcCrypto(data).value).toBe(0)
    expect(calcNetWorth(data)).toBe(0)
    expect(applyCryptoCostFallback(data)).toBe(data)
    expect(listUnpricedHoldings(data)).toHaveLength(1)
    expect(unpricedExclusionCopy(1)).toMatch(/unpriced — excluded/)
    expect(read('../components/UnpricedExclusionBanner.tsx')).toMatch(/unpriced-exclusion/)
  })

  it('cashflow labels Recurring vs Settings, stables, 0 or 1 month', () => {
    expect(ledgerMonthCountCopy(0)).toBe('0 months')
    expect(ledgerMonthCountCopy(1)).toBe('1 month')
    const data = createSamplePortfolio()
    expect(settingsMonthlyInflow(data)).toBe(4200)
    expect(stablesBreakdown(data).some((s) => s.symbol === 'USDC')).toBe(true)
    const story = buildCashflowStory(data)
    expect(story.book).toBe('recurring')
    const page = read('../pages/CashflowPage.tsx')
    expect(page).toMatch(/Recurring income/)
    expect(page).toMatch(/Settings inflow/)
    expect(page).toMatch(/ledgerMonthCountCopy/)
    expect(page).not.toMatch(/SYNC_KEY/)
  })

  it('FIRE / goals / Monte Carlo use leftover — no silent £1,500', () => {
    expect(DEFAULT_FIRE.savings).toBe(0)
    const sample = createSamplePortfolio()
    expect(hasExplicitFireInputs(sample.fireInputs)).toBe(false)
    expect(resolveFireSavings(sample)).toBe(cashflowLeftoverSavings(sample))
    expect(estimateMonthlySurplus(sample)).toBeNull()
    const empty = createEmptyPortfolio()
    empty.recurringTransactions = [
      { id: 1, name: 'Pay', amount: 2000, category: 'income', frequency: 'monthly', nextDue: '2026-08-01' },
      { id: 2, name: 'Rent', amount: 500, category: 'bills', frequency: 'monthly', nextDue: '2026-08-01' },
    ]
    expect(cashflowLeftoverSavings(empty)).toBe(1500)
    expect(resolveFireSavings(empty)).toBe(1500)
    expect(read('../domain/fire.ts')).toMatch(/savings: 0/)
    expect(read('../domain/normalize.ts')).toMatch(/savings: num\(r\.savings, 0\)/)
  })

  it('one debt balance and descending pay-down', () => {
    const data = createEmptyPortfolio()
    data.creditCards = [{ id: 1, name: 'Card', balance: 200, apr: 20, minPay: 20, limit: 1000 }]
    data.loans = [{ id: 1, name: 'Loan', balance: 300, apr: 5, minPay: 30, original: 800 }]
    expect(calcDebtBalance(data)).toBe(500)
    expect(debtPaydownProgress(800, 500, 0)).toBe(37.5)
    expect(read('../pages/LiabilitiesPage.tsx')).toMatch(/One balance — cards \+ loans/)
  })

  it('/money cockpit is leftover + runway + four doors', () => {
    expect(MONEY_DOORS.map((d) => d.label)).toEqual(['Spend', 'Holdings', 'Tax', 'Import'])
    const money = read('../pages/MoneyPage.tsx')
    expect(money).toMatch(/money-cockpit/)
    expect(money).toMatch(/Leftover/)
    expect(money).toMatch(/Runway/)
    expect(money).toMatch(/buildCashflowStory/)
  })

  it('News / YouTube live in sidebar MENU; launch picker has /youtube', () => {
    expect(PRIMARY_NAV.map((i) => i.label)).toEqual([
      'Today',
      'Markets',
      'Money',
      'Plan',
      'Household',
    ])
    expect(resolveBottomNavItems().map((i) => i.to)).toEqual([
      '/',
      '/markets',
      '/money',
      '/plan',
      '/household',
    ])
    expect(LAUNCH_PATH_OPTIONS.some((o) => o.path === '/youtube')).toBe(true)
    const sidebar = read('../components/layout/Sidebar.tsx')
    expect(sidebar).toMatch(/SIDEBAR_NAV/)
    expect(sidebar).toMatch(/newsUnreadFromCache/)
    expect(sidebar).toMatch(/youtubeUnreadFromCache/)
    expect(sidebar).toMatch(/sidebar-news-unread/)
    const smart = read('../components/SmartNotifications.tsx')
    expect(smart).toMatch(/syncCategory\('news', \[\]\)/)
    expect(read('../components/layout/ToolbarControls.tsx')).not.toMatch(/MediaChromeChips/)
  })

  it('Today fold: one NW, one action, one risk; landscape keeps the figure', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-net-worth-value/)
    expect(dash).toMatch(/title="Next"/)
    expect(dash).toMatch(/alerts\.slice\(0, 1\)/)
    expect(dash).toMatch(/UnpricedExclusionBanner/)
    expect(dash).toMatch(/resolveFireSavings/)
    expect(dash).toMatch(/ariaLabel="Next action"/)
    expect(dash).not.toMatch(/title="To-dos"\s*\n\s*enabled=\{todayAccordionEnabled\}\s*\n\s*defaultOpen\s*\n\s*order=\{todaySectionOrder\.indexOf\('next'\)\}/)
    const css = read('../index.css')
    expect(css).toMatch(/orientation: landscape/)
    expect(css).toMatch(/\.today-net-worth-value/)
  })

  it('Markets: Live / Fetching / Unpriced only — no fake 0.00%', () => {
    const page = read('../pages/MarketsPage.tsx')
    expect(page).toMatch(/return 'Live'/)
    expect(page).toMatch(/return 'Fetching'/)
    expect(page).toMatch(/return 'Unpriced'/)
    expect(page).not.toMatch(/return 'Unavailable'/)
    expect(page).toMatch(/pct == null/)
    expect(page).toMatch(/typeof q\?\.changePct === 'number'/)
    expect(page).toMatch(/sectionGroupChangeLabel/)
    expect(page).toMatch(/markets-section-change/)
    expect(read('../domain/marketsSectionTotals.ts')).toMatch(/never 0\.00%/)
  })

  it('390 header: Refresh is on the strip; no header NEWS/YOUTUBE chips', () => {
    const css = read('../index.css')
    expect(css).toMatch(/@media \(max-width: 767px\)/)
    expect(css).toMatch(/\.toolbar-refresh/)
    expect(css).toMatch(/\.toolbar-bell-slot/)
    expect(css).not.toMatch(/\.app-header-row\s*\{[^}]*overflow:\s*hidden/s)
    expect(read('../components/SmartNotifications.tsx')).toMatch(/toolbar-bell-slot/)
    const shell = read('../components/layout/AppShell.tsx')
    expect(shell).not.toMatch(/MediaChromeChips/)
    expect(shell).not.toMatch(/media-chrome-chips-phone/)
    expect(shell).not.toMatch(/sm:hidden flex-1 min-w-0/)
    expect(read('../components/layout/ToolbarControls.tsx')).toMatch(/toolbar-refresh/)
  })

  it('auto monthly NW snapshots from the priced book — no invented months', () => {
    const data = createEmptyPortfolio()
    data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.1, price: 80000, cost: 4000 }]
    const now = new Date(2026, 7, 15)
    const once = upsertMonthlyPricedSnapshot(data, now)
    expect(once.history).toHaveLength(1)
    expect(once.history[0]?.notes).toBe('monthly priced')
    expect(once.history[0]?.crypto).toBe(8000)
    const twice = upsertMonthlyPricedSnapshot(once, now)
    expect(twice.history).toHaveLength(1)
    expect(read('../context/PortfolioContext.tsx')).toMatch(/upsertMonthlyPricedSnapshot/)
  })

  it('Household names whose book and an honest family total', () => {
    expect(memberBookLabel({ id: 'primary', type: 'primary', name: 'You' }, [{ id: 'p1', name: 'David' }], 'p1')).toBe(
      'You · David',
    )
    expect(
      memberBookLabel(
        { id: 'partner', type: 'partner', name: 'Sam', portfolioId: 'p2' },
        [
          { id: 'p1', name: 'David' },
          { id: 'p2', name: 'Sam SIPP' },
        ],
        'p1',
      ),
    ).toBe('Sam · Sam SIPP')
    const page = read('../pages/FamilyPage.tsx')
    expect(page).toMatch(/household-whose-book/)
    expect(page).toMatch(/Family total/)
    expect(page).toMatch(/Each book once/)
  })
})
