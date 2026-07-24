import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildNextActionStack,
  stackIncludesBill,
} from '../domain/nextActionStack'
import { categorySparklinesForMonth } from '../domain/spendingCategorySparkline'
import { taxYearProgress } from '../domain/taxYearProgress'
import { getTaxPack } from '../domain/taxPacks'
import { netWorthSparkSeries } from '../domain/netWorthSparkline'
import type { HistoryPoint, RecurringTransaction } from '../domain/types'
import type { TodoItem } from '../domain/todo-types'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

function stubTodo(partial: Partial<TodoItem> & { id: number; title: string }): TodoItem {
  return {
    listId: 1,
    status: 'open',
    priority: 'medium',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

function stubBill(partial: Partial<RecurringTransaction> & { id: number; name: string }): RecurringTransaction {
  return {
    amount: 100,
    frequency: 'monthly',
    category: 'bills',
    nextDue: '2026-07-18',
    ...partial,
  }
}

describe('next25c today / money / tax (16–20)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('16: next-action stack max 3 — todo / bill / mover; Dashboard wires stack', () => {
    const now = new Date(2026, 6, 16) // Jul 16
    const cards = buildNextActionStack({
      now,
      todoItems: [
        stubTodo({ id: 1, title: 'Pay tax', dueDate: '2026-07-16' }),
        stubTodo({ id: 2, title: 'Later', dueDate: '2026-08-01' }),
      ],
      recurringTransactions: [
        stubBill({ id: 10, name: 'Rent', nextDue: '2026-07-18', amount: 1200 }),
        stubBill({ id: 11, name: 'Gym', nextDue: '2026-07-20', amount: 40 }),
      ],
      movers: [
        { symbol: 'BTC', changePct: 2.1 },
        { symbol: 'ETH', changePct: -5.5 },
      ],
    })
    expect(cards).toHaveLength(3)
    expect(cards[0]?.kind).toBe('todo')
    expect(cards[1]?.kind).toBe('bill')
    expect(cards[2]?.kind).toBe('mover')
    if (cards[2]?.kind === 'mover') {
      expect(cards[2].symbol).toBe('ETH')
    }
    expect(stackIncludesBill(cards)).toBe(true)

    const capped = buildNextActionStack({
      now,
      max: 2,
      todoItems: [stubTodo({ id: 1, title: 'A', dueDate: '2026-07-16' })],
      recurringTransactions: [stubBill({ id: 1, name: 'B', nextDue: '2026-07-17' })],
      movers: [{ symbol: 'X', changePct: 1 }],
    })
    expect(capped).toHaveLength(2)

    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-next-action-stack/)
    expect(dash).toMatch(/buildNextActionStack/)
    expect(dash).toMatch(/stackIncludesBill/)
    expect(dash).toMatch(/today-focus-card/)
    expect(dash).toMatch(/markFocusDone/)
  })

  it('17: spending category sparklines for selected month', () => {
    const rows = categorySparklinesForMonth(
      [
        { id: 1, date: '2026-07-01', description: 'A', amount: 10, category: 'food', method: 'debit' },
        { id: 2, date: '2026-07-02', description: 'B', amount: 5, category: 'food', method: 'debit' },
        { id: 3, date: '2026-07-01', description: 'C', amount: 40, category: 'travel', method: 'debit' },
        { id: 4, date: '2026-06-01', description: 'Old', amount: 99, category: 'food', method: 'debit' },
      ],
      '2026-07',
      5,
    )
    expect(rows[0]?.category).toBe('travel')
    expect(rows[0]?.total).toBe(40)
    expect(rows[1]?.category).toBe('food')
    expect(rows[1]?.total).toBe(15)
    expect(rows[1]?.daily[0]).toBe(10)
    expect(rows[1]?.daily[1]).toBe(5)
    expect(rows[1]?.daily).toHaveLength(31)

    const spend = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')
    expect(spend).toMatch(/spending-category-sparklines/)
    expect(spend).toMatch(/categorySparklinesForMonth/)
    expect(spend).toMatch(/MiniBarChart/)
  })

  it('18: tax year progress ring — days left + CGT used', () => {
    const pack = getTaxPack('GB')
    // Mid UK tax year 2025/26: 6 Apr 2025 → 5 Apr 2026; pick 16 Jul 2025
    const mid = taxYearProgress(pack, '2025/26', 1500, new Date(2025, 6, 16))
    expect(mid.daysLeft).toBeGreaterThan(0)
    expect(mid.daysTotal).toBeGreaterThan(360)
    expect(mid.allowance).toBe(3000)
    expect(mid.cgtUsed).toBe(1500)
    expect(mid.cgtUsedPct).toBeCloseTo(0.5, 5)

    const cal = taxYearProgress(getTaxPack('IE'), '2026', 500, new Date(2026, 6, 16))
    expect(cal.daysLeft).toBeGreaterThan(0)
    expect(cal.allowance).toBe(1270)

    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')
    expect(tax).toMatch(/tax-year-progress/)
    expect(tax).toMatch(/taxYearProgress/)
    expect(tax).toMatch(/days left/)
    expect(tax).toMatch(/Est\. CGT used/)
  })

  it('19: net-worth sparkline 7d/30d from history', () => {
    const now = new Date(2026, 6, 16)
    const history: HistoryPoint[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 6, 16 - (29 - i))
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      history.push({ date: `${y}-${m}-${day}`, netWorth: 100_000 + i * 100 })
    }
    const s7 = netWorthSparkSeries(history, 103_000, 7, now)
    const s30 = netWorthSparkSeries(history, 103_000, 30, now)
    expect(s7.length).toBeGreaterThanOrEqual(2)
    expect(s30.length).toBeGreaterThanOrEqual(2)
    expect(s30.length).toBeGreaterThan(s7.length)
    expect(s7[s7.length - 1]).toBe(103_000)

    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-nw-sparkline/)
    expect(dash).toMatch(/netWorthSparkSeries/)
    expect(dash).toMatch(/nwSparkDays/)
    expect(dash).toMatch(/7d/)
    expect(dash).toMatch(/30d/)
  })

  it('20: Compare invite copy sheet for second portfolio', () => {
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/compare-invite-btn/)
    expect(compare).toMatch(/compare-invite-sheet/)
    expect(compare).toMatch(/Add a second portfolio/)
    expect(compare).toMatch(/inviteOpen/)
    expect(compare).toMatch(/settings#portfolios/)
    expect(compare).toMatch(/opening-balance wizard/)
  })

  it('package version is tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.95')
  })
})
