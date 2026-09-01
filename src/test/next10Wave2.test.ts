import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { buildNextActionStack } from '../domain/nextActionStack'
import { spendingHighlightUrl, recurringFocusUrl } from '../domain/deepLinks'
import { buildAlerts } from '../domain/alerts'
import type { PortfolioData } from '../domain/types'

const readPage = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next10 wave 2 (v1.2.111)', () => {
  it('0: package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.162')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.162')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.162',
      '1.2.161',
      '1.2.160',
      '1.2.159',
      '1.2.158',
    ])
  })

  it('1: Holdings master-detail sticky clears search + totals heights', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/--holdings-search-height/)
    expect(css).toMatch(/--holdings-totals-height/)
    expect(css).toMatch(/holdings-master-detail-panel/)
    for (const name of ['EquitiesPage.tsx', 'CryptoPage.tsx'] as const) {
      expect(readPage(name)).toMatch(/holdingsTotalsRef/)
      expect(readPage(name)).toMatch(/--holdings-totals-height/)
    }
  })

  it('2: Money ops rows use compact OverflowMenu', () => {
    for (const name of [
      'SpendingPage.tsx',
      'RecurringPage.tsx',
      'BudgetsPage.tsx',
      'LiabilitiesPage.tsx',
    ] as const) {
      const src = readPage(name)
      expect(src).toMatch(/OverflowMenu/)
      expect(src).toMatch(/compact/)
    }
  })

  it('3: Tax disposal helper + remittance guidance', () => {
    const link = readFileSync(resolve(__dirname, '../domain/taxDisposalLink.ts'), 'utf8')
    expect(link).toMatch(/export function/)
    expect(readPage('HoldingDetailPage.tsx')).toMatch(/taxDisposal|Tax disposal|buildTaxDisposal/i)
    expect(readPage('TaxPage.tsx')).toMatch(/remittance/i)
  })

  it('4: Deep-link helpers + bill/budget alert URLs', () => {
    expect(spendingHighlightUrl(42, { category: 'food', month: '2026-07' })).toBe(
      '/spending?highlight=42&category=food&month=2026-07',
    )
    expect(recurringFocusUrl(7)).toBe('/recurring?focus=7')
    const ym = new Date().toISOString().slice(0, 7)
    const alerts = buildAlerts({
      spending: [
        {
          id: 9,
          date: `${ym}-01`,
          description: 'Groceries',
          category: 'food',
          method: 'card',
          amount: -120,
        },
      ],
      budgetGoals: { food: 50 },
      recurringTransactions: [
        {
          id: 3,
          name: 'Rent',
          amount: 1000,
          frequency: 'monthly',
          nextDue: new Date().toISOString().slice(0, 10),
          category: 'housing',
          active: true,
        },
      ],
      creditCards: [],
      loans: [],
      goals: [],
      crypto: [],
      equities: [],
      targetAllocations: {},
      monthlyIncome: 5000,
      disposals: [],
      settings: {},
    } as unknown as PortfolioData)
    expect(alerts.some((a) => a.to.includes('/spending?highlight=9'))).toBe(true)
    expect(alerts.some((a) => a.to === '/recurring?focus=3')).toBe(true)
  })

  it('5: Today Next action uses max 1', () => {
    expect(readPage('Dashboard.tsx')).toMatch(/max:\s*1/)
    expect(readPage('Dashboard.tsx')).toMatch(/ariaLabel="Next action"/)
    const stack = buildNextActionStack({
      todoItems: [
        {
          id: 1,
          listId: 1,
          title: 'A',
          status: 'open',
          priority: 'high',
          dueDate: new Date().toISOString().slice(0, 10),
          sortOrder: 0,
          createdAt: '',
          updatedAt: '',
        },
      ],
      recurringTransactions: [
        {
          id: 2,
          name: 'Bill',
          amount: 10,
          frequency: 'monthly',
          nextDue: new Date().toISOString().slice(0, 10),
          category: 'bills',
          active: true,
        },
      ],
      max: 1,
    } as never)
    expect(stack.length).toBeLessThanOrEqual(1)
  })

  it('6: Markets screener LWW helpers', () => {
    const store = readFileSync(resolve(__dirname, '../storage/marketsStore.ts'), 'utf8')
    expect(store).toMatch(/getMarketsScreener/)
    expect(store).toMatch(/setMarketsScreener/)
    expect(readPage('MarketsPage.tsx')).toMatch(/getMarketsScreener|setMarketsScreener/)
  })

  it('7: Broker portfolio CSV uses shared aliases / broker date order', () => {
    const csv = readFileSync(resolve(__dirname, '../services/tradeCsvImport.ts'), 'utf8')
    expect(csv).toMatch(/TRADE_CSV_COLUMN_ALIASES/)
    expect(csv).toMatch(/t\.price/)
    expect(csv).toMatch(/ibcommission/)
    expect(readPage('EquitiesPage.tsx')).toMatch(/parsePortfolioTradeCsv/)
  })

  it('8: Compare Week Δ cites previous-week snapshot', () => {
    const compare = readPage('ComparePage.tsx')
    expect(compare).toMatch(/previous-week snapshot/)
    expect(compare).not.toMatch(/first Compare visit this week/)
  })

  it('9: Lower-traffic pages drop thumb CTA bars', () => {
    for (const name of [
      'SettingsPage.tsx',
      'PlanningPage.tsx',
      'FirePage.tsx',
      'StakingPage.tsx',
      'AchievementsPage.tsx',
      'DocumentsPage.tsx',
    ] as const) {
      expect(readPage(name)).not.toMatch(/className="thumb-cta-bar"/)
    }
  })

  it('10: Sync unlock onboarding CTA + announceWhatArrived', () => {
    expect(readPage('SettingsPage.tsx')).toMatch(/sync-unlock-onboarding-cta/)
    expect(readPage('SettingsPage.tsx')).toMatch(/announceWhatArrived/)
    const highlights = readFileSync(
      resolve(__dirname, '../services/sync/syncHighlights.ts'),
      'utf8',
    )
    expect(highlights).toMatch(/export function announceWhatArrived/)
  })
})
