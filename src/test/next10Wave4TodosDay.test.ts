import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('next-10 wave 4 To Do Day view', () => {
  it('puts overdue work before today blocks with visible row actions', () => {
    const page = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    const overdueIndex = page.indexOf('data-testid="todos-day-overdue"')
    const segmentsIndex = page.indexOf('{TODO_DAY_SEGMENTS.map')

    expect(overdueIndex).toBeGreaterThan(0)
    expect(segmentsIndex).toBeGreaterThan(overdueIndex)
    expect(page).toMatch(/dayOverdueItems/)
    expect(page).toMatch(/todos-day-row-actions/)
    expect(page).toMatch(/handleFocus/)
    expect(page).toMatch(/Focus/)
    expect(page).toMatch(/Snooze/)
    expect(page).toMatch(/Complete/)
  })

  it('keeps focus deep links visible and the list picker shrinkable', () => {
    const page = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    const picker = readFileSync(resolve(__dirname, '../components/TodoListPicker.tsx'), 'utf8')

    expect(page).toMatch(/visibleInDay/)
    expect(page).toMatch(/setViewMode\('list'\)/)
    expect(page).toMatch(/setFocusTodoId\(item\.id\)/)
    expect(picker).toMatch(/todo-list-picker-control min-w-0/)
    expect(picker).toMatch(/flex min-w-0 flex-wrap/)
  })
})
