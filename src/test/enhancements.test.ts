import { describe, expect, it } from 'vitest'
import { exportJobsToCsv, parseCsvToJobApplications, parseJsonToJobApplications } from '../domain/jobs'
import { createJobApplication } from '../domain/jobs'
import { extractDueDate } from '../domain/todoOcr'
import {
  buildReminderSchedule,
  parseReminderMs,
  reminderKey,
} from '../domain/todoReminders'
import { detectConflicts, diffFields, conflictKey } from '../services/sync/conflicts'
import { allConflictsResolved } from '../services/sync/syncService'
import { createEmptyPortfolio } from '../domain/defaults'
import { createTodoItem, createTodoList } from '../domain/todos'
import { collectReferencedBlobIds } from '../storage/blobIds'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'

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

  it('allConflictsResolved requires every conflict choice', () => {
    const conflicts = [
      {
        portfolioId: 'default',
        collection: 'todoItems' as const,
        id: 1,
        localLabel: 'A',
        remoteLabel: 'B',
      },
      {
        portfolioId: 'default',
        collection: 'jobApplications' as const,
        id: 2,
        localLabel: 'X',
        remoteLabel: 'Y',
      },
    ]
    expect(allConflictsResolved(conflicts, {})).toBe(false)
    expect(
      allConflictsResolved(conflicts, { [conflictKey(conflicts[0])]: 'local' }),
    ).toBe(false)
    expect(
      allConflictsResolved(conflicts, {
        [conflictKey(conflicts[0])]: 'local',
        [conflictKey(conflicts[1])]: 'remote',
      }),
    ).toBe(true)
  })
})

describe('document blob id collection', () => {
  it('collects vault and job customDocument blob ids', () => {
    const data = createEmptyPortfolio()
    data.documents = [
      {
        id: 11,
        name: 'Passport',
        createdAt: new Date().toISOString(),
        hasBlob: true,
      },
    ]
    data.jobApplications = [
      createJobApplication({
        companyName: 'Co',
        jobTitle: 'Role',
        status: 'applied',
        customDocuments: [
          { name: 'CV', hasBlob: true, blobDocId: 42 },
          { name: 'Link only', url: 'https://example.com' },
        ],
      }),
    ]
    expect(collectReferencedBlobIds(data).sort()).toEqual([11, 42])
  })
})

describe('kanban sortOrder helpers', () => {
  it('sorts and reapplies contiguous sortOrder', () => {
    const apps = [
      createJobApplication({ id: 1, companyName: 'A', jobTitle: '1', status: 'applied', sortOrder: 2 }),
      createJobApplication({ id: 2, companyName: 'B', jobTitle: '2', status: 'applied', sortOrder: 0 }),
      createJobApplication({ id: 3, companyName: 'C', jobTitle: '3', status: 'applied', sortOrder: 1 }),
    ]
    const sorted = sortBySortOrder(apps)
    expect(sorted.map((a) => a.id)).toEqual([2, 3, 1])
    const reordered = applySortOrder([sorted[2], sorted[0], sorted[1]])
    expect(reordered.map((a) => a.sortOrder)).toEqual([0, 1, 2])
  })
})

describe('todo reminder schedule', () => {
  it('builds schedule for future reminders', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const y = tomorrow.getFullYear()
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const d = String(tomorrow.getDate()).padStart(2, '0')
    const item = createTodoItem({
      id: 99,
      listId: 1,
      title: 'Call recruiter',
      reminderDate: `${y}-${m}-${d}`,
      reminderTime: '10:30',
    })
    const at = parseReminderMs(item)
    expect(at).not.toBeNull()
    expect(reminderKey(item)).toBe(`99:${y}-${m}-${d}:10:30`)
    const schedule = buildReminderSchedule([item])
    expect(schedule).toHaveLength(1)
    expect(schedule[0].title).toBe('Call recruiter')
    expect(schedule[0].fireAt).toBe(at)
  })

  it('skips done items', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const y = tomorrow.getFullYear()
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const d = String(tomorrow.getDate()).padStart(2, '0')
    const item = createTodoItem({
      id: 100,
      listId: 1,
      title: 'Done task',
      status: 'done',
      reminderDate: `${y}-${m}-${d}`,
      reminderTime: '09:00',
    })
    expect(buildReminderSchedule([item])).toHaveLength(0)
  })
})
