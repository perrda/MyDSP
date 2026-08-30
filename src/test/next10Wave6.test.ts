import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { suggestColumnAliases } from '../services/tradeCsvImport'
import { applyTodayLayoutPreset, loadTodayLayout, TODAY_LAYOUT_PRESETS } from '../storage/todayLayoutStore'
import {
  dismissMerchantRuleSuggestion,
  isMerchantRuleSuggestionDismissed,
  loadDismissedMerchantRulePatterns,
} from '../domain/merchantRuleSuggestionDismissPref'
import { planningMonteCarloUrl } from '../domain/deepLinks'
import { buildAlerts } from '../domain/alerts'
import { getTaxPack } from '../domain/taxPacks'
import { isCorporateActionDue } from '../domain/corporateActions'
import type { PortfolioData } from '../domain/types'

const readPage = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next10 wave 6 tip harness (v1.2.117)', () => {
  beforeEach(() => localStorage.clear())

  it('0: package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.137')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.137')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.137',
      '1.2.135',
      '1.2.134',
      '1.2.133',
      '1.2.132',
    ])
  })

  it('1: Today Work/Money/Quiet presets + Reset', () => {
    expect(Object.keys(TODAY_LAYOUT_PRESETS)).toEqual(['work', 'money', 'quiet'])
    applyTodayLayoutPreset('quiet')
    expect(loadTodayLayout().hidden).toContain('charts')
    expect(loadTodayLayout().hidden).not.toContain('markets')
    expect(readPage('Dashboard.tsx')).toMatch(/today-layout-preset-\$\{id\}/)
    expect(readPage('Dashboard.tsx')).toMatch(/Show all \/ Reset/)
  })

  it('2: Primary nav is Today · Markets · Money · Plan · Household', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/nav-favourites-list/)
    const sidebar = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')
    expect(sidebar).toMatch(/SIDEBAR_NAV/)
    expect(sidebar).not.toMatch(/nav-others-toggle/)
  })

  it('3: Markets tag+Yield discoverability', () => {
    expect(readPage('MarketsPage.tsx')).toMatch(/markets-tag-yield-hint|settings#prices/)
    expect(readPage('SettingsPage.tsx')).toMatch(/Syncs across devices/)
  })

  it('4: Commodities holdings page route', () => {
    expect(readPage('CommoditiesPage.tsx')).toMatch(/commodities-page|paperCommodityValue/)
    expect(readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')).toMatch(/path="commodities"/)
  })

  it('5: Deeper remittance tax pack copy', () => {
    expect(getTaxPack('IE').remittanceBasisGuidance).toMatch(/remittance/i)
    expect(getTaxPack('TH').remittanceBasisGuidance).toMatch(/remitted/i)
    expect(getTaxPack('US').remittanceBasisGuidance).toMatch(/Form 8949|worldwide/i)
  })

  it('6: Broker CSV unknown-column alias suggestions', () => {
    const suggestions = suggestColumnAliases(['Trade Date', 'Qtyy', 'Px', 'Symbole'])
    expect(suggestions.some((s) => s.suggestedField === 'date' || s.suggestedField === 'qty')).toBe(
      true,
    )
    expect(readFileSync(resolve(__dirname, '../services/tradeCsvImport.ts'), 'utf8')).toMatch(
      /suggestColumnAliases/,
    )
  })

  it('7: Spending rule Accept/Dismiss persistence', () => {
    dismissMerchantRuleSuggestion('Pret')
    expect(isMerchantRuleSuggestionDismissed('pret')).toBe(true)
    expect(loadDismissedMerchantRulePatterns()).toContain('pret')
    expect(readPage('SpendingPage.tsx')).toMatch(/suggested-rule-accept|suggested-rule-dismiss/)
  })

  it('8: Analytics scenario seeds Planning Monte Carlo', () => {
    const href = planningMonteCarloUrl(100000, 500, {
      meanReturnPct: 6,
      inflationPct: 2,
      scenario: 'Base',
    })
    expect(href).toContain('tab=montecarlo')
    expect(href).toContain('mean=6')
    expect(href).toContain('scenario=Base')
    expect(readPage('PredictiveAnalyticsPage.tsx')).toMatch(/analytics-open-planning/)
    expect(readPage('PlanningPage.tsx')).toMatch(/searchParams\.get\('mean'\)/)
    expect(readPage('PlanningPage.tsx')).toMatch(/planning-inflation/)
    expect(readPage('PlanningPage.tsx')).toMatch(/planning-scenario-seed/)
  })

  it('9: Documents reverse link to Job', () => {
    expect(readPage('DocumentsPage.tsx')).toMatch(/document-linked-job|Open linked job/)
  })

  it('10: Notification Center liability-due + corp-action', () => {
    expect(isCorporateActionDue('2000-01-01')).toBe(true)
    const alerts = buildAlerts({
      creditCards: [
        {
          id: 1,
          name: 'Card',
          balance: 100,
          apr: 20,
          minPay: 25,
          limit: 1000,
          paymentDueDay: new Date().getDate(),
        },
      ],
      loans: [],
      equities: [
        {
          id: 9,
          symbol: 'ACME',
          name: 'Acme',
          qty: 1,
          price: 10,
          cost: 8,
          corporateActionNote: 'Split',
          corporateActionDate: '2000-01-01',
        },
      ],
      crypto: [],
      spending: [],
      recurringTransactions: [],
      goals: [],
      budgetGoals: {},
      monthlyIncome: 5000,
      targetAllocations: { equity: 60, crypto: 20, cash: 20 },
      fireInputs: { savings: 0, returnRate: 7 },
    } as unknown as PortfolioData)
    expect(alerts.some((a) => a.id.startsWith('liability-due-'))).toBe(true)
    expect(alerts.some((a) => a.id.startsWith('corp-action-'))).toBe(true)
  })
})
