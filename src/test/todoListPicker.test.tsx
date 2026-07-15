import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TodoListPicker } from '../components/TodoListPicker'
import type { TodoList } from '../domain/todo-types'

const lists: TodoList[] = [
  {
    id: 1,
    name: 'General',
    color: '#F7931A',
    icon: 'list',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    sortOrder: 0,
  },
  {
    id: 2,
    name: 'Walking Tours',
    color: '#22c55e',
    icon: 'list',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    sortOrder: 1,
  },
]

describe('TodoListPicker', () => {
  it('opens a vertical menu and selects All lists', () => {
    const onSelect = vi.fn()
    render(
      <TodoListPicker
        lists={lists}
        selectedListId={1}
        counts={new Map([[1, 0], [2, 11]])}
        totalCount={11}
        onSelect={onSelect}
        onReorder={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /list: general/i }))
    expect(screen.getByRole('listbox', { name: /todo lists/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: /all lists/i }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('selects a named list from the menu', () => {
    const onSelect = vi.fn()
    render(
      <TodoListPicker
        lists={lists}
        selectedListId={null}
        counts={new Map([[1, 0], [2, 11]])}
        totalCount={11}
        onSelect={onSelect}
        onReorder={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /list: all lists/i }))
    fireEvent.click(screen.getByRole('option', { name: /walking tours/i }))
    expect(onSelect).toHaveBeenCalledWith(2)
  })
})
