import { describe, expect, it } from 'vitest'
import {
  candidatesToTodoItems,
  isNoiseLine,
  moveTodoItemsToList,
  parseOcrTextToCandidates,
  stripTaskPrefix,
} from '../domain/todoOcr'
import { createTodoItem } from '../domain/todos'

describe('todoOcr', () => {
  it('strips checkbox and bullet prefixes', () => {
    expect(stripTaskPrefix('☐ Buy milk').text).toBe('Buy milk')
    expect(stripTaskPrefix('[x] Done thing').completed).toBe(true)
    expect(stripTaskPrefix('1. Call bank').text).toBe('Call bank')
    expect(stripTaskPrefix('- Review ISA').text).toBe('Review ISA')
  })

  it('filters noise lines', () => {
    expect(isNoiseLine('Today')).toBe(true)
    expect(isNoiseLine('Todos')).toBe(true)
    expect(isNoiseLine('12:30')).toBe(true)
    expect(isNoiseLine('Pay council tax')).toBe(false)
  })

  it('parses a realistic screenshot OCR dump', () => {
    const text = `
Todos
Today
☐ Pay council tax
[ ] Renew car insurance
✓ Book dentist
- Transfer to ISA urgent
Inbox
    `.trim()

    const candidates = parseOcrTextToCandidates(text)
    expect(candidates.map((c) => c.title)).toEqual([
      'Pay council tax',
      'Renew car insurance',
      'Book dentist',
      'Transfer to ISA urgent',
    ])
    expect(candidates.find((c) => c.title === 'Book dentist')?.completed).toBe(true)
    expect(candidates.find((c) => c.title.includes('ISA'))?.priority).toBe('high')
  })

  it('creates todo items with import tags', () => {
    const items = candidatesToTodoItems(
      [{ title: 'Test task', priority: 'medium', completed: false }],
      42,
    )
    expect(items).toHaveLength(1)
    expect(items[0].listId).toBe(42)
    expect(items[0].tags).toContain('ocr')
    expect(items[0].status).toBe('todo')
  })

  it('moves items between lists', () => {
    const items = [
      createTodoItem({ id: 1, listId: 10, title: 'A' }),
      createTodoItem({ id: 2, listId: 10, title: 'B' }),
      createTodoItem({ id: 3, listId: 11, title: 'C' }),
    ]
    const moved = moveTodoItemsToList(items, [1, 2], 99)
    expect(moved.find((i) => i.id === 1)?.listId).toBe(99)
    expect(moved.find((i) => i.id === 2)?.listId).toBe(99)
    expect(moved.find((i) => i.id === 3)?.listId).toBe(11)
  })
})
