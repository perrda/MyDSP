import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calculateFinancialHealth, estimateFireYears } from '../domain/advancedAnalytics'
import { exportPortfolioSummary } from '../domain/apiExport'
import { getDisposalsForYear } from '../domain/cgt'
import { createEmptyPortfolio } from '../domain/defaults'
import { todayKey } from '../domain/history'
import { isaUsedFromHoldings } from '../domain/isaHoldings'
import { parseLocalYmd } from '../domain/monthUtils'
import { todayKeyLocal } from '../domain/moneyPulse'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { sumSpendInRange } from '../domain/spendingWeekDelta'
import { normalizeDate } from '../services/csvImport'
import { buildFullReportHtml } from '../utils/fullReportHtml'
import { globalSearch } from '../utils/search'

const src = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('bug hunt 1.2.118', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.118')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.118')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.118',
      '1.2.117',
      '1.2.116',
      '1.2.114',
      '1.2.113',
    ])
  })

  it('ISA crypto uses unit mark price, not total cost × qty', () => {
    const data = createEmptyPortfolio()
    data.crypto = [
      {
        id: 1,
        symbol: 'USDC',
        name: 'USD Coin',
        qty: 1000,
        price: 0,
        cost: 1000,
        platform: 'Crypto ISA',
      },
    ]
    const isa = isaUsedFromHoldings(data)
    expect(isa.used).toBe(1000)
    expect(isa.used).not.toBe(1_000_000)
  })

  it('FIRE years start from net worth, not gross assets', () => {
    const yearsFromAssets = estimateFireYears({
      assets: 500_000,
      monthlyIncome: 5000,
      monthlyExpenses: 3000,
      annualReturnPct: 0,
    })
    const yearsFromNw = estimateFireYears({
      assets: 500_000,
      liabilities: 400_000,
      monthlyIncome: 5000,
      monthlyExpenses: 3000,
      annualReturnPct: 0,
    })
    expect(yearsFromAssets).toBeLessThan(yearsFromNw!)
    expect(yearsFromNw).toBeGreaterThan(yearsFromAssets!)
  })

  it('financial health emergency months use cash when provided', () => {
    const assetsOnly = calculateFinancialHealth({
      netWorth: 400_000,
      assets: 400_000,
      liabilities: 0,
      monthlyIncome: 4000,
      monthlyExpenses: 2000,
      spending: [],
      budgetGoals: {},
    })
    const cashOnly = calculateFinancialHealth({
      netWorth: 400_000,
      assets: 400_000,
      liabilities: 0,
      monthlyIncome: 4000,
      monthlyExpenses: 2000,
      spending: [],
      budgetGoals: {},
      cash: 2000,
    })
    expect(assetsOnly.components.emergencyFund.months).toBe(200)
    expect(cashOnly.components.emergencyFund.months).toBe(1)
  })

  it('week spend and reports skip income rows', () => {
    expect(
      sumSpendInRange(
        [
          { date: '2026-08-10', amount: 40, category: 'food' },
          { date: '2026-08-11', amount: 500, category: 'income' },
        ],
        '2026-08-10',
        '2026-08-16',
      ),
    ).toBe(40)

    const html = buildFullReportHtml({
      crypto: [{ symbol: 'USDC', qty: 1000, price: 0, cost: 1000 }],
      spending: [
        { date: '2026-08-10', description: 'Salary', category: 'income', amount: 2000 },
        { date: '2026-08-11', description: 'Food', category: 'food', amount: 40 },
      ],
    })
    expect(html).not.toContain('income')
    expect(html).toContain('food')
  })

  it('API export and PDF use mark prices, not cost×qty', () => {
    const data = createEmptyPortfolio()
    data.crypto = [{ id: 1, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 0, cost: 1000 }]
    data.equities = [
      { id: 1, symbol: 'VWRL', name: 'Vanguard', shares: 10, avgCost: 80, livePrice: 0 },
    ]
    const summary = exportPortfolioSummary(data)
    expect(summary.data.assets.crypto).toBe(1000)
    expect(summary.data.assets.equities).toBe(800)
    expect(summary.data.netWorth).toBe(1800)
  })

  it('history today key matches local money-pulse calendar', () => {
    expect(todayKey()).toBe(todayKeyLocal())
    const evening = parseLocalYmd('2026-04-05')
    expect(evening?.getFullYear()).toBe(2026)
    expect(evening?.getMonth()).toBe(3)
    expect(evening?.getDate()).toBe(5)
    const disposals = getDisposalsForYear(
      [
        {
          id: 1,
          date: '2026-04-05',
          assetType: 'equity',
          symbol: 'VWRL',
          qty: 1,
          proceeds: 100,
          cost: 80,
        },
        {
          id: 2,
          date: '2026-04-06',
          assetType: 'equity',
          symbol: 'VWRL',
          qty: 1,
          proceeds: 100,
          cost: 80,
        },
      ],
      '2025/26',
    )
    expect(disposals.map((d) => d.date)).toEqual(['2026-04-05'])
    expect(normalizeDate('2026-04-05')).toBe('2026-04-05')
  })

  it('deep-links wait for hydrate and keep journal / list / highlight params', () => {
    const spending = src('../pages/SpendingPage.tsx')
    expect(spending).toMatch(/new URLSearchParams\(searchParams\)/)
    expect(spending).not.toMatch(/const params: Record<string, string> = \{ month: ym \}/)

    const todos = src('../pages/TodosPage.tsx')
    expect(todos).toMatch(/searchParams.get\('list'\)/)
    expect(todos).toMatch(/if \(!item\) return/)
    expect(todos).not.toMatch(/if \(!item\) \{\s*setSearchParams/)

    const recurring = src('../pages/RecurringPage.tsx')
    expect(recurring).toMatch(/if \(!item\) return/)

    const journal = src('../pages/JournalPage.tsx')
    expect(journal).toMatch(/searchParams.get\('highlight'\)/)
    expect(journal).toMatch(/journal-row-\$\{/)

    const search = src('../utils/search.ts')
    expect(search).toMatch(/spendingHighlightUrl\(s\.id\)/)
    expect(search).toMatch(/\/todos\?focus=\$\{t\.id\}/)

    const sample = createEmptyPortfolio()
    sample.spending = [
      {
        id: 9,
        date: '2026-08-10',
        description: 'Tesco',
        category: 'food',
        amount: 12,
        method: 'debit',
      },
    ]
    const hits = globalSearch('Tesco', sample)
    expect(hits[0]?.url).toContain('highlight=9')
  })

  it('Markets ownership and Predictive Analytics use shared helpers', () => {
    const markets = src('../pages/MarketsPage.tsx')
    expect(markets).toMatch(/cryptoMarkPrice\(c\)/)
    expect(markets).toMatch(/equityUnitPriceGbp\(e\)/)
    expect(markets).not.toMatch(/c\.qty \* c\.price/)

    const predictive = src('../pages/PredictiveAnalyticsPage.tsx')
    expect(predictive).toMatch(/isBudgetSpend\(s\)/)
    expect(predictive).toMatch(/cash: calcCash\(data\)/)
    expect(predictive).toMatch(/liabilities: totalLiabilities/)
    expect(predictive).toMatch(/fromLedger > 0 \? fromLedger : Math.max\(0, data.monthlyExpenses\)/)
  })

  it('digest listeners stay mounted; hash routes keep #sync', () => {
    const dash = src('../pages/Dashboard.tsx')
    expect(dash).toMatch(/openWeeklyDigestRef/)
    expect(dash).toMatch(/useEffect\(\(\) => \{[\s\S]*mydsp-open-weekly-digest[\s\S]*\}, \[\]\)/)

    const compare = src('../pages/ComparePage.tsx')
    expect(compare).toMatch(/exportWeeklyDigestRef/)

    const launch = src('../components/LaunchRedirect.tsx')
    expect(launch).toMatch(/rest.startsWith\('#'\)/)
  })
})
