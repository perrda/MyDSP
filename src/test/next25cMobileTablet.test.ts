import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseTodoQuickAdd } from '../domain/todoQuickAdd'
import { calculateJobPipelineCounts } from '../domain/jobPipeline'
import type { JobApplication } from '../domain/job-types'

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

function stubApp(status: JobApplication['status']): JobApplication {
  return {
    id: Math.random(),
    companyName: 'Co',
    jobTitle: 'Role',
    status,
    priority: 'medium',
    source: 'Test',
    salaryCurrency: 'GBP',
    salaryPeriod: 'annual',
    location: 'Remote',
    remote: 'remote',
    jobType: 'full-time',
    customDocuments: [],
    interviews: [],
    notes: [],
    contacts: [],
    tasks: [],
    rating: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
  }
}

describe('next25c mobile / tablet (11–15)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('11: page-route-transition CSS + AppShell wrapper; reduced-motion safe', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.page-route-transition/)
    expect(css).toMatch(/@keyframes page-route-in/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?\.page-route-transition/)

    const transition = readFileSync(
      resolve(__dirname, '../components/layout/PageRouteTransition.tsx'),
      'utf8',
    )
    expect(transition).toMatch(/page-route-transition/)
    expect(transition).toMatch(/pathname/)

    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/PageRouteTransition/)
  })

  it('12: Jobs pipeline mini-card uses status counts', () => {
    const stages = calculateJobPipelineCounts([
      stubApp('wishlist'),
      stubApp('applied'),
      stubApp('screening'),
      stubApp('interviewing'),
      stubApp('offer'),
      stubApp('rejected'),
    ])
    const byId = Object.fromEntries(stages.map((s) => [s.id, s.count]))
    expect(byId.wishlist).toBe(1)
    expect(byId.applied).toBe(2)
    expect(byId.interview).toBe(1)
    expect(byId.offer).toBe(1)
    expect(byId.closed).toBe(1)

    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(jobs).toMatch(/jobs-pipeline-mini/)
    expect(jobs).toMatch(/calculateJobPipelineCounts/)
    expect(jobs).toMatch(/Job pipeline counts/)
  })

  it('13: todos NL quick-add parses weekday / tomorrow / next week', () => {
    // Fixed Wednesday 2026-07-15
    const wed = new Date(2026, 6, 15)
    expect(parseTodoQuickAdd('Pay rent Friday', wed)).toEqual({
      title: 'Pay rent',
      dueDate: '2026-07-17',
    })
    expect(parseTodoQuickAdd('Call bank tomorrow', wed)).toEqual({
      title: 'Call bank',
      dueDate: '2026-07-16',
    })
    expect(parseTodoQuickAdd('Submit form next week', wed)).toEqual({
      title: 'Submit form',
      dueDate: '2026-07-22',
    })
    expect(parseTodoQuickAdd('Buy milk today', wed)).toEqual({
      title: 'Buy milk',
      dueDate: '2026-07-15',
    })
    expect(parseTodoQuickAdd('Just a task', wed)).toEqual({ title: 'Just a task' })

    const todos = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(todos).toMatch(/todos-quick-add/)
    expect(todos).toMatch(/parseTodoQuickAdd/)
    expect(todos).toMatch(/Pay rent Friday/)
  })

  it('14: Settings split sticky nav at min-width 900px', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.settings-split/)
    expect(css).toMatch(/\.settings-split-nav/)
    expect(css).toMatch(/min-width:\s*900px/)
    expect(css).toMatch(/position:\s*sticky/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/settings-split/)
    expect(settings).toMatch(/settings-split-nav/)
    expect(settings).toMatch(/SETTINGS_SECTION_IDS\.map/)
    expect(settings).toMatch(/jumpToSettingsSection/)
  })

  it('15: PullToRefresh only on Today and Markets', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/allowPullToRefresh/)
    expect(shell).toMatch(/pathname === '\/'/)
    expect(shell).toMatch(/pathname === '\/markets'/)
    expect(shell).toMatch(/disabled=\{allowPullToRefresh\(pathname\) \? undefined : true\}/)
  })

  it('package version is 1.2.47', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.65')
  })
})
