import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('next10 priorities wave', () => {
  it('1: Spending ?highlight= deep-link scroll + row ids', () => {
    const page = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')
    expect(page).toMatch(/searchParams\.get\('highlight'\)/)
    expect(page).toMatch(/spending-row-\$\{/)
    expect(page).toMatch(/data-testid=\{`spending-row-\$\{/)
    expect(page).toMatch(/todo-focus-ring/)
  })

  it('2: Recurring ?focus= deep-link scroll + row ids', () => {
    const page = readFileSync(resolve(__dirname, '../pages/RecurringPage.tsx'), 'utf8')
    expect(page).toMatch(/searchParams\.get\('focus'\)/)
    expect(page).toMatch(/recurring-row-\$\{/)
    expect(page).toMatch(/data-testid=\{`recurring-row-\$\{/)
  })

  it('3: Dashboard Today bill + pulse deep-links', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/to: `\/recurring\?focus=\$\{bill\.id\}`/)
    expect(dash).toMatch(/to=\{`\/recurring\?focus=\$\{card\.bill\.id\}`\}/)
    expect(dash).toMatch(/to=\{`\/recurring\?focus=\$\{r\.id\}`\}/)
    expect(dash).toMatch(/data-testid="today-money-pulse"/)
    expect(dash).toMatch(/to="\/history"/)
    expect(dash).toMatch(/data-testid="today-career-pulse"/)
    expect(dash).toMatch(/to="\/jobs"/)
  })

  it('4: Compare week-Δ honesty note', () => {
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/compare-week-delta-note/)
    expect(compare).toMatch(/data-testid="compare-week-delta-note"/)
    expect(compare).toMatch(/first Compare visit this week/)
  })
})
