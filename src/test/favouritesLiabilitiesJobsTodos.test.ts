import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizePortfolio } from '../domain/normalize'
import { createTodoItem, completeTodoWithRecurrence } from '../domain/todos'
import { parseTodoQuickAdd } from '../domain/todoQuickAdd'

function src(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8')
}

describe('Favourites excellence: liabilities, jobs, todos', () => {
  it('liabilities expose due day, search, validation, paid-off notes, and commentary thumb CTA', () => {
    const list = src('../pages/LiabilitiesPage.tsx')
    const detail = src('../pages/LiabilityDetailPage.tsx')
    const types = src('../domain/types.ts')
    const normalize = src('../domain/normalize.ts')

    expect(types).toMatch(/paymentDueDay\?: number/)
    expect(normalize).toMatch(/normalizePaymentDueDay/)
    expect(list).toMatch(/liabilities-search/)
    expect(list).toMatch(/validation\.errors/)
    expect(list).toMatch(/liability-payment-due-day/)
    expect(detail).toMatch(/Add commentary/)
    expect(detail).toMatch(/notes: latestNoteText/)
    expect(types).toMatch(/commentaries\?: ProgressCommentary\[\]/)
  })

  it('jobs surface all filters, expanded search, upcoming strip, task sync, and shared modals', () => {
    const jobs = src('../pages/JobsPage.tsx')
    const detail = src('../pages/JobDetailPage.tsx')
    const form = src('../components/JobFormModal.tsx')
    const contact = src('../components/ContactModal.tsx')

    expect(jobs).toMatch(/JOB_FILTER_OPTIONS/)
    expect(jobs).toMatch(/no-response/)
    expect(jobs).toMatch(/follow-up/)
    expect(jobs).toMatch(/a\.source\.toLowerCase/)
    expect(jobs).toMatch(/contacts\.some/)
    expect(jobs).toMatch(/data-testid="jobs-upcoming-strip"/)
    expect(detail).toMatch(/linkedTodoId/)
    expect(detail).toMatch(/completeTodoWithRecurrence/)
    expect(detail).toMatch(/To Do's is the system of record/)
    expect(form).toMatch(/<Modal/)
    expect(contact).toMatch(/<Modal/)
  })

  it('todos add recurrence, archived restore, focused reminders, quick-add metadata, and tablet panes', () => {
    const todos = src('../pages/TodosPage.tsx')
    const modal = src('../components/TodoModal.tsx')
    const reminders = src('../domain/todoReminders.ts')
    const sw = src('../../public/sw.js')
    const css = src('../index.css')

    expect(modal).toMatch(/todo-recurrence-select/)
    expect(todos).toMatch(/completeTodoWithRecurrence/)
    expect(todos).toMatch(/value="archived"/)
    expect(todos).toMatch(/handleRestoreItem/)
    expect(reminders).toMatch(/\/todos\?focus=\$\{item\.id\}/)
    expect(sw).toMatch(/\/todos\?focus=\$\{r\.id\}/)
    expect(todos).toMatch(/todos-tablet-two-pane/)
    expect(css).toMatch(/todos-tablet-two-pane/)
  })

  it('normalizes todo recurrence and paid-off liability archives', () => {
    const data = normalizePortfolio({
      todoItems: [{ id: 1, listId: 1, title: 'Water plants', recurrence: 'weekly' }],
      paidOff: [
        {
          name: 'Card',
          original: 100,
          paidDate: '2026-01-01',
          apr: 19.9,
          notes: 'Negotiated settlement',
          commentaries: [{ id: 1, text: 'Called lender', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
        },
      ],
    })

    expect(data.todoItems[0]?.recurrence).toBe('weekly')
    expect(data.paidOff[0]?.apr).toBe(19.9)
    expect(data.paidOff[0]?.notes).toBe('Negotiated settlement')
    expect(data.paidOff[0]?.commentaries?.[0]?.text).toBe('Called lender')
  })

  it('completes recurring todos by keeping the occurrence and creating the next due item', () => {
    const item = createTodoItem({
      id: 1,
      listId: 1,
      title: 'Submit timesheet',
      dueDate: '2026-01-10',
      reminderDate: '2026-01-09',
      recurrence: 'weekly',
      priority: 'high',
      tags: ['work'],
    })

    const next = completeTodoWithRecurrence([item], 1, '2026-01-10T12:00:00.000Z')
    expect(next).toHaveLength(2)
    expect(next.find((t) => t.id === 1)?.status).toBe('done')
    const spawned = next.find((t) => t.id !== 1)
    expect(spawned?.status).toBe('todo')
    expect(spawned?.dueDate).toBe('2026-01-17')
    expect(spawned?.reminderDate).toBe('2026-01-16')
    expect(spawned?.recurrence).toBe('weekly')
    expect(spawned?.priority).toBe('high')
  })

  it('quick-add parses priority and tags without breaking date parsing', () => {
    const parsed = parseTodoQuickAdd('Pay rent Friday ! #bills', new Date(2026, 0, 5))
    expect(parsed.title).toBe('Pay rent')
    expect(parsed.priority).toBe('high')
    expect(parsed.tags).toEqual(['bills'])
    expect(parsed.dueDate).toBe('2026-01-09')
  })
})
