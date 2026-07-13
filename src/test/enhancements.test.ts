import { describe, expect, it } from 'vitest'
import { exportJobsToCsv, parseCsvToJobApplications, parseJsonToJobApplications } from '../domain/jobs'
import { createJobApplication } from '../domain/jobs'
import { extractDueDate } from '../domain/todoOcr'
import { detectConflicts, diffFields } from '../services/sync/conflicts'
import { createEmptyPortfolio } from '../domain/defaults'
import { createTodoItem, createTodoList } from '../domain/todos'

describe('jobs import/export', () => {
  it('round-trips CSV company and title', () => {
    const app = createJobApplication({
      companyName: 'Acme Ltd',
      jobTitle: 'Engineer',
      status: 'applied',
      priority: 'high',
      location: 'London',
      remote: 'hybrid',
      source: 'LinkedIn',
    })
    const csv = exportJobsToCsv([app])
    const parsed = parseCsvToJobApplications(csv)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].companyName).toBe('Acme Ltd')
    expect(parsed[0].jobTitle).toBe('Engineer')
    expect(parsed[0].status).toBe('applied')
  })

  it('parses JSON applications array', () => {
    const json = JSON.stringify({
      applications: [{ companyName: 'Beta', jobTitle: 'PM', status: 'wishlist' }],
    })
    const apps = parseJsonToJobApplications(json)
    expect(apps).toHaveLength(1)
    expect(apps[0].companyName).toBe('Beta')
  })
})

describe('smarter OCR dates', () => {
  it('extracts today/tomorrow and strips from title', () => {
    const t = extractDueDate('Pay rent tomorrow')
    expect(t.title).toBe('Pay rent')
    expect(t.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('extracts UK-style dates', () => {
    const t = extractDueDate('Submit form 15/08/2026')
    expect(t.title).toBe('Submit form')
    expect(t.dueDate).toBe('2026-08-15')
  })
})

describe('sync conflict field diffs', () => {
  it('lists differing fields', () => {
    const diffs = diffFields({ title: 'A', status: 'todo' }, { title: 'B', status: 'todo' })
    expect(diffs.some((d) => d.field === 'title')).toBe(true)
  })

  it('detects todo and job conflicts', () => {
    const local = createEmptyPortfolio()
    const remote = createEmptyPortfolio()
    const list = createTodoList({ id: 1, name: 'General' })
    local.todoLists = [list]
    remote.todoLists = [{ ...list, name: 'General (remote)' }]
    local.todoItems = [createTodoItem({ id: 10, listId: 1, title: 'Local task' })]
    remote.todoItems = [createTodoItem({ id: 10, listId: 1, title: 'Remote task' })]
    local.jobApplications = [
      createJobApplication({ id: 5, companyName: 'A', jobTitle: 'Dev', status: 'applied' }),
    ]
    remote.jobApplications = [
      createJobApplication({ id: 5, companyName: 'A', jobTitle: 'Dev', status: 'interviewing' }),
    ]

    const conflicts = detectConflicts('default', local, remote)
    expect(conflicts.some((c) => c.collection === 'todoLists')).toBe(true)
    expect(conflicts.some((c) => c.collection === 'todoItems')).toBe(true)
    expect(conflicts.some((c) => c.collection === 'jobApplications')).toBe(true)
    const job = conflicts.find((c) => c.collection === 'jobApplications')
    expect(job?.fieldDiffs?.some((d) => d.field === 'status')).toBe(true)
  })
})
