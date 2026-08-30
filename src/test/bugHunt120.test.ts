import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { estimateFireYears } from '../domain/advancedAnalytics'
import { exportPortfolioSummary } from '../domain/apiExport'
import { getDisposalsForYear } from '../domain/cgt'
import { createEmptyPortfolio } from '../domain/defaults'
import { todayKey } from '../domain/history'
import { isaUsedFromHoldings } from '../domain/isaHoldings'
import { parseLocalYmd } from '../domain/monthUtils'
import { todayKeyLocal } from '../domain/moneyPulse'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { normalizeDate } from '../services/csvImport'
import { globalSearch } from '../utils/search'

const src = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('bug hunt leftovers (v1.2.120)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.132')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.132')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.132',
      '1.2.131',
      '1.2.130',
      '1.2.129',
      '1.2.128',
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

  it('API export uses the priced book — unpriced lines are out', () => {
    const data = createEmptyPortfolio()
    data.crypto = [{ id: 1, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 0, cost: 1000 }]
    data.equities = [
      { id: 1, symbol: 'VWRL', name: 'Vanguard', shares: 10, avgCost: 80, livePrice: 0 },
    ]
    const unpriced = exportPortfolioSummary(data)
    expect(unpriced.data.assets.crypto).toBe(0)
    expect(unpriced.data.assets.equities).toBe(0)
    expect(unpriced.data.netWorth).toBe(0)

    data.crypto = [{ id: 1, symbol: 'USDC', name: 'USD Coin', qty: 1000, price: 1, cost: 1000 }]
    data.equities = [
      { id: 1, symbol: 'VWRL', name: 'Vanguard', shares: 10, avgCost: 80, livePrice: 80 },
    ]
    const live = exportPortfolioSummary(data)
    expect(live.data.assets.crypto).toBe(1000)
    expect(live.data.assets.equities).toBe(800)
    expect(live.data.netWorth).toBe(1800)
  })

  it('history today key and CGT year bounds use the local calendar', () => {
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

  it('deep-links wait for hydrate and keep highlight / list params', () => {
    const spending = src('../pages/SpendingPage.tsx')
    expect(spending).toMatch(/new URLSearchParams\(searchParams\)/)
    expect(spending).not.toMatch(/const params: Record<string, string> = \{ month: ym \}/)

    const todos = src('../pages/TodosPage.tsx')
    expect(todos).toMatch(/searchParams.get\('list'\)/)
    expect(todos).toMatch(/if \(!item\) return/)
    expect(todos).toMatch(/if \(!list\) return/)
    expect(todos).not.toMatch(/if \(!item\) \{\s*setSearchParams/)
    expect(todos).not.toMatch(/if \(!list\) \{\s*setSearchParams/)

    const recurring = src('../pages/RecurringPage.tsx')
    expect(recurring).toMatch(/if \(!item\) return/)

    const journal = src('../pages/JournalPage.tsx')
    expect(journal).toMatch(/searchParams.get\('highlight'\)/)
    expect(journal).toMatch(/id=\{`journal-\$\{j\.id\}`\}/)

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
    expect(hits.some((h) => h.url?.includes('highlight=9'))).toBe(true)
  })

  it('hash routes keep #sync; Predictive FIRE uses liabilities', () => {
    const launch = src('../components/LaunchRedirect.tsx')
    expect(launch).toMatch(/rest.startsWith\('#'\)/)
    const predictive = src('../pages/PredictiveAnalyticsPage.tsx')
    expect(predictive).toMatch(/liabilities: totalLiabilities/)
    expect(predictive).toMatch(/estimateMonthlyExpenses/)
  })
})
