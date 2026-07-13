import { describe, it, expect } from 'vitest'
import { createEmptyPortfolio } from '../domain/defaults'
import { normalizePortfolio, toStorageShape } from '../domain/normalize'
import { createJobApplication } from '../domain/jobs'
import { createTodoItem, createTodoList } from '../domain/todos'
import { mergePortfolio } from '../services/sync/merge'

describe('Portfolio persistence — jobs & todos', () => {
  it('round-trips jobApplications through toStorageShape / normalizePortfolio', () => {
    const base = createEmptyPortfolio()
    const job = createJobApplication({
      companyName: 'Acme Ltd',
      jobTitle: 'Engineer',
      location: 'London',
      tags: ['fintech'],
    })
    const withJob = { ...base, jobApplications: [job] }

    const stored = toStorageShape(withJob)
    expect(stored.jobApplications).toBeDefined()
    expect(Array.isArray(stored.jobApplications)).toBe(true)
    expect((stored.jobApplications as unknown[]).length).toBe(1)

    const restored = normalizePortfolio(stored)
    expect(restored.jobApplications).toHaveLength(1)
    expect(restored.jobApplications[0].companyName).toBe('Acme Ltd')
    expect(restored.jobApplications[0].jobTitle).toBe('Engineer')
    expect(restored.jobApplications[0].tags).toEqual(['fintech'])
    expect(restored.jobApplications[0].interviews).toEqual([])
    expect(restored.jobApplications[0].tasks).toEqual([])
  })

  it('round-trips todoLists and todoItems', () => {
    const base = createEmptyPortfolio()
    const list = createTodoList({ name: 'Finance tasks' })
    const item = createTodoItem({ listId: list.id, title: 'Pay credit card', priority: 'high' })
    const withTodos = { ...base, todoLists: [list], todoItems: [item] }

    const stored = toStorageShape(withTodos)
    expect(stored.todoLists).toBeDefined()
    expect(stored.todoItems).toBeDefined()

    const restored = normalizePortfolio(stored)
    expect(restored.todoLists).toHaveLength(1)
    expect(restored.todoLists[0].name).toBe('Finance tasks')
    expect(restored.todoItems).toHaveLength(1)
    expect(restored.todoItems[0].title).toBe('Pay credit card')
    expect(restored.todoItems[0].tags).toEqual([])
    expect(restored.todoItems[0].priority).toBe('high')
  })

  it('normalizes malformed job records without crashing', () => {
    const restored = normalizePortfolio({
      version: 1,
      jobApplications: [{ id: 1, companyName: 'X' }],
    })
    expect(restored.jobApplications).toHaveLength(1)
    expect(restored.jobApplications[0].jobTitle).toBe('Untitled role')
    expect(restored.jobApplications[0].tags).toEqual([])
    expect(restored.jobApplications[0].customDocuments).toEqual([])
  })

  it('merges jobs and todos across sync portfolios', () => {
    const local = createEmptyPortfolio()
    const remote = createEmptyPortfolio()
    const localJob = createJobApplication({ companyName: 'LocalCo', jobTitle: 'A' })
    const remoteJob = createJobApplication({ companyName: 'RemoteCo', jobTitle: 'B' })
    const localList = createTodoList({ name: 'Local' })
    const remoteList = createTodoList({ name: 'Remote' })

    local.jobApplications = [localJob]
    remote.jobApplications = [remoteJob]
    local.todoLists = [localList]
    remote.todoLists = [remoteList]

    const merged = mergePortfolio(local, remote)
    expect(merged.jobApplications).toHaveLength(2)
    expect(merged.todoLists).toHaveLength(2)
  })
})
