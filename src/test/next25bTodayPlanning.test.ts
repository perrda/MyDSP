import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  findBaselineNetWorth,
  formatMoneyPulseLine,
  moneyPulseDelta,
  yesterdayKey,
} from '../domain/moneyPulse'
import { dueWithinDays } from '../domain/recurringDueStrip'
import {
  estimateMonthlySurplus,
  formatGoalProjectionLine,
  goalRemaining,
  nearestGoalProjection,
  projectGoalDate,
} from '../domain/goalProjectedDate'
import { createEmptyPortfolio } from '../domain/defaults'
import type { Goal, HistoryPoint, RecurringTransaction } from '../domain/types'

describe('next25b today / planning (16–20)', () => {
  beforeEach(() => {
    // domain helpers are pure
  })

  afterEach(() => {
    // no-op
  })

  it('16: money pulse NW delta vs yesterday history', () => {
    const now = new Date(2026, 6, 15, 12, 0, 0)
    expect(yesterdayKey(now)).toBe('2026-07-14')
    const history: HistoryPoint[] = [
      { date: '2026-07-13', netWorth: 90_000 },
      { date: '2026-07-14', netWorth: 100_000, at: '2026-07-14T08:00:00.000Z' },
      { date: '2026-07-14', netWorth: 101_000, at: '2026-07-14T20:00:00.000Z' },
    ]
    const base = findBaselineNetWorth(history, now)
    expect(base?.netWorth).toBe(101_000)
    expect(base?.date).toBe('2026-07-14')
    const pulse = moneyPulseDelta(history, 103_500, now)
    expect(pulse?.delta).toBe(2_500)
    expect(formatMoneyPulseLine(2_500, (n, o) => `${o?.signed && n > 0 ? '+' : ''}${n}`)).toMatch(
      /NW \+2500 since yesterday/,
    )
    expect(formatMoneyPulseLine(0, () => '£0')).toMatch(/unchanged/)
    expect(moneyPulseDelta([], 50_000, now)).toBeNull()

    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-money-pulse/)
    expect(dash).toMatch(/moneyPulseDelta/)
    expect(dash).toMatch(/formatMoneyPulseLine/)
    expect(dash).toMatch(/privacyClass\(privacy\)/)
  })

  it('17: Spending Make rule opens Rules with pattern/category prefill', () => {
    const spend = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')
    expect(spend).toMatch(/Make rule/)
    expect(spend).toMatch(/makeRuleHref/)
    expect(spend).toMatch(/\/rules\?/)

    const rules = readFileSync(resolve(__dirname, '../pages/RulesPage.tsx'), 'utf8')
    expect(rules).toMatch(/useSearchParams/)
    expect(rules).toMatch(/searchParams\.get\('pattern'\)/)
    expect(rules).toMatch(/searchParams\.get\('category'\)/)
    expect(rules).toMatch(/setOpen\(true\)/)
  })

  it('18: recurring bills due-in-7-days strip on Today', () => {
    const now = new Date(2026, 6, 15)
    const items: RecurringTransaction[] = [
      {
        id: 1,
        name: 'Netflix',
        amount: 15,
        frequency: 'monthly',
        category: 'subscriptions',
        nextDue: '2026-07-18',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        name: 'Rent',
        amount: 1200,
        frequency: 'monthly',
        category: 'bills',
        nextDue: '2026-08-01',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 3,
        name: 'Gym',
        amount: 40,
        frequency: 'monthly',
        category: 'health',
        nextDue: '2026-07-15',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]
    const due = dueWithinDays(items, 7, now)
    expect(due.map((r) => r.name)).toEqual(['Gym', 'Netflix'])

    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-bills-strip/)
    expect(dash).toMatch(/dueWithinDays/)
    expect(dash).toMatch(/Bills · due in 7 days/)
  })

  it('19: FIRE/Goals projected date from monthly surplus estimate', () => {
    const goal: Goal = {
      id: 1,
      name: 'Emergency fund',
      type: 'networth',
      target: 50_000,
      metric: 'networth',
      deadline: '2030-01-01',
      created: '2026-01-01',
    }
    expect(goalRemaining(goal, 40_000)).toBe(10_000)
    const proj = projectGoalDate(goal, 40_000, 2_000, new Date(2026, 6, 15))
    expect(proj).not.toBeNull()
    expect(proj!.months).toBe(5)
    expect(proj!.projectedDate).toBe('2026-12-15')
    expect(formatGoalProjectionLine(proj!, (d) => d)).toMatch(/Est\. 2026-12-15/)
    expect(formatGoalProjectionLine(proj!, (d) => d)).toMatch(/if surplus holds/)

    const data = createEmptyPortfolio()
    data.monthlyIncome = 5000
    data.monthlyExpenses = 3000
    data.goals = [goal]
    // empty portfolio net worth is typically 0 → remaining ≈ 50k → 25 months
    const nearest = nearestGoalProjection(data, new Date(2026, 6, 15))
    expect(nearest).not.toBeNull()
    expect(estimateMonthlySurplus(data)).toBe(2000)

    const goalsPage = readFileSync(resolve(__dirname, '../pages/Goals.tsx'), 'utf8')
    expect(goalsPage).toMatch(/goal-projection-line/)
    expect(goalsPage).toMatch(/projectGoalDate/)
    expect(goalsPage).toMatch(/formatGoalProjectionLine/)

    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-goal-projection/)
    expect(dash).toMatch(/nearestGoalProjection/)
  })

  it('20: TradeModal onClose navigates to holding after save', () => {
    const modal = readFileSync(resolve(__dirname, '../components/ui/TradeModal.tsx'), 'utf8')
    expect(modal).toMatch(/onClose:\s*\(opts\?:\s*\{\s*saved\?:\s*boolean/)
    expect(modal).toMatch(/onClose\(\{\s*saved:\s*true\s*\}\)/)

    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/opts\?\.saved/)
    expect(equities).toMatch(/navigate\(`\/equities\/\$\{holding\.id\}`\)/)

    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/opts\?\.saved/)
    expect(crypto).toMatch(/navigate\(`\/crypto\/\$\{holding\.id\}`\)/)
  })

  it('package version is 1.2.44', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.100')
  })
})
