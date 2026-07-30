import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  liabilitiesDueWithinDays,
  nextLiabilityDueDate,
} from '../domain/liabilityHelpers'
import { suggestMerchantRules } from '../domain/merchantRules'
import type { CreditCard, MerchantRule, SpendingEntry } from '../domain/types'
import {
  DEFAULT_TODAY_SECTION_ORDER,
  exportTodayLayoutForBackup,
  importTodayLayoutFromBackup,
  loadTodayLayout,
  saveTodayLayout,
} from '../storage/todayLayoutStore'

const page = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next 10 wave 5 items 1–4', () => {
  beforeEach(() => localStorage.clear())

  it('persists Today order/hidden and keeps newer local layout during LWW import', () => {
    const saved = saveTodayLayout(
      {
        order: ['goals', 'next', 'bills', 'dailyPlan', 'careerPulse'],
        hidden: ['careerPulse'],
      },
      { markDirty: false },
    )
    importTodayLayoutFromBackup({
      order: [...DEFAULT_TODAY_SECTION_ORDER],
      hidden: [],
      updatedAt: '2020-01-01T00:00:00.000Z',
    })
    expect(loadTodayLayout()).toEqual(saved)
    expect(exportTodayLayoutForBackup()?.updatedAt).toBe(saved.updatedAt)
    expect(page('Dashboard.tsx')).toMatch(/ReorderList|todaySectionOrder/)
  })

  it('ranks unmatched merchants by count and ignores descriptions covered by rules', () => {
    const spending: SpendingEntry[] = [
      { id: 1, date: '2026-07-01', amount: 4, description: 'Pret', category: 'food', method: 'debit' },
      { id: 2, date: '2026-07-02', amount: 5, description: ' pret ', category: 'food', method: 'debit' },
      { id: 3, date: '2026-07-03', amount: 9, description: 'TFL', category: 'transport', method: 'debit' },
    ]
    const rules: MerchantRule[] = [
      { id: 1, pattern: 'TFL', matchType: 'contains', category: 'transport' },
    ]
    expect(suggestMerchantRules(spending, rules)).toEqual([
      {
        pattern: 'Pret',
        category: 'food',
        count: 2,
        latestDate: '2026-07-02',
      },
    ])
    expect(page('SpendingPage.tsx')).toMatch(/Suggested rules|makeRuleHref/)
  })

  it('clamps monthly liability dates and returns the next 30-day calendar', () => {
    const card: CreditCard = {
      id: 7,
      name: 'Card',
      balance: 500,
      apr: 20,
      minPay: 25,
      limit: 1_000,
      paymentDueDay: 31,
    }
    const from = new Date(2026, 3, 15)
    expect(nextLiabilityDueDate(card, from)).toBe('2026-04-30')
    expect(liabilitiesDueWithinDays([card], [], 30, from)).toEqual([
      {
        kind: 'card',
        id: 7,
        name: 'Card',
        minPay: 25,
        dueDate: '2026-04-30',
        daysUntil: 15,
      },
    ])
    expect(page('LiabilitiesPage.tsx')).toMatch(/payment=1&amount=|Due calendar/)
  })

  it('renders a persistent corporate-action strip with anchored detail links', () => {
    const equities = page('EquitiesPage.tsx')
    expect(equities).toMatch(/equities-corporate-actions-due/)
    expect(equities).toMatch(/#corporate-action/)
  })
})
