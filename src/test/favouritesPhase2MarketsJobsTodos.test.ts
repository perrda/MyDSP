import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizePortfolio } from '../domain/normalize'
import { normalizePriceAlertThreshold } from '../domain/priceAlerts'

function src(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8')
}

describe('Favourites phase 2 follow-ups: Markets, Jobs, Todos', () => {
  it('markets expose screener filters, related news, and target alert UI', () => {
    const markets = src('../pages/MarketsPage.tsx')
    const alerts = src('../domain/priceAlerts.ts')

    expect(markets).toMatch(/data-testid="markets-search"/)
    expect(markets).toMatch(/data-testid="markets-screener"/)
    expect(markets).toMatch(/Owned/)
    expect(markets).toMatch(/Alerts set/)
    expect(markets).toMatch(/Stale/)
    expect(markets).toMatch(/data-testid="markets-quote-news"/)
    expect(markets).toMatch(/Target price/)
    expect(alerts).toMatch(/mode\?: 'percent' \| 'target'/)
    expect(alerts).toMatch(/targetPrice\?: number/)
  })

  it('normalizes percent and target price alerts from existing storage', () => {
    expect(normalizePriceAlertThreshold({ key: 'BTC', changePct: 3 })).toEqual({
      key: 'BTC',
      changePct: 3,
      mode: 'percent',
    })
    expect(
      normalizePriceAlertThreshold({
        key: 'TSLA',
        mode: 'target',
        changePct: 5,
        targetPrice: 250,
      }),
    ).toEqual({
      key: 'TSLA',
      changePct: 5,
      mode: 'target',
      targetPrice: 250,
    })
  })

  it('jobs expose two-week calendar, offer compare, and paste ingest helper', () => {
    const jobs = src('../pages/JobsPage.tsx')
    const form = src('../components/JobFormModal.tsx')

    expect(jobs).toMatch(/data-testid="jobs-calendar-strip"/)
    expect(jobs).toMatch(/data-testid="jobs-offer-compare"/)
    expect(jobs).toMatch(/setDate\(end\.getDate\(\) \+ 14\)/)
    expect(form).toMatch(/data-testid="job-paste-ingest"/)
    expect(form).toMatch(/extractJobPostFields/)
  })

  it('todos expose subtasks, day view, and shared-list hint', () => {
    const types = src('../domain/todo-types.ts')
    const todos = src('../pages/TodosPage.tsx')
    const modal = src('../components/TodoModal.tsx')
    const listModal = src('../components/TodoListModal.tsx')

    expect(types).toMatch(/subtasks\?: TodoSubtask\[\]/)
    expect(types).toMatch(/shared\?: boolean/)
    expect(todos).toMatch(/data-testid="todos-day-view"/)
    expect(todos).toMatch(/subtasks/)
    expect(modal).toMatch(/Add a subtask/)
    expect(listModal).toMatch(/data-testid="todos-list-share-hint"/)
  })

  it('normalizes todo subtasks and shared-list hints safely', () => {
    const normalized = normalizePortfolio({
      todoLists: [{ id: 1, name: 'Household', isSharedHint: true }],
      todoItems: [
        {
          id: 2,
          listId: 1,
          title: 'Plan dinner',
          subtasks: [
            { id: 3, title: 'Shop', done: true },
            { id: 4, title: '', done: false },
          ],
        },
      ],
    })

    expect(normalized.todoLists[0]?.shared).toBe(true)
    expect(normalized.todoItems[0]?.subtasks).toEqual([{ id: 3, title: 'Shop', done: true }])
  })
})
