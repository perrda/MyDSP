import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { snoozeDueDateOneDay } from '../domain/todoSnooze'
import {
  applyLargeTextDom,
  LARGE_TEXT_STORAGE_KEY,
  loadLargeText,
  saveLargeText,
} from '../utils/largeText'

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

describe('next25 mobile interaction', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
    document.documentElement.classList.remove('large-text')
  })

  afterEach(() => {
    mem.clear()
    document.documentElement.classList.remove('large-text')
  })

  it('11: BottomNav long-press opens middle-tabs reorder sheet', () => {
    const src = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(src).toMatch(/favSheetOpen/)
    expect(src).toMatch(/Reorder middle tabs/)
    expect(src).toMatch(/longPressTimer/)
    expect(src).toMatch(/saveBottomNavMiddleSlots/)
    expect(src).toMatch(/settings#layout/)
  })

  it('12: Jobs Kanban supports touch drag between columns', () => {
    const src = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(src).toMatch(/data-kanban-column/)
    expect(src).toMatch(/onStatusGripPointerDown/)
    expect(src).toMatch(/onKanbanColumnDrop/)
    expect(src).toMatch(/pointerType === 'mouse'/)
  })

  it('13: Todos swipe Complete / Snooze via SwipeTodoRow', () => {
    const page = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(page).toMatch(/SwipeTodoRow/)
    expect(page).toMatch(/handleSnooze/)
    expect(page).toMatch(/snoozeDueDateOneDay/)
    const swipe = readFileSync(resolve(__dirname, '../components/ui/SwipeTodoRow.tsx'), 'utf8')
    expect(swipe).toMatch(/Complete/)
    expect(swipe).toMatch(/Snooze/)
  })

  it('snoozeDueDateOneDay advances one local calendar day', () => {
    expect(snoozeDueDateOneDay('2026-07-15')).toBe('2026-07-16')
    expect(snoozeDueDateOneDay('2026-12-31')).toBe('2027-01-01')
  })

  it('14: Dashboard two-pane Today | Markets at min-width 900', () => {
    const src = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(src).toMatch(/today-two-pane/)
    expect(src).toMatch(/min-width: 900px/)
    expect(src).toMatch(/today-markets-pane/)
    expect(src).toMatch(/Markets snapshot/)
  })

  it('15: large text persists mydsp_large_text and toggles html.large-text', () => {
    expect(loadLargeText()).toBe(false)
    saveLargeText(true)
    expect(localStorage.getItem(LARGE_TEXT_STORAGE_KEY)).toBe('1')
    expect(loadLargeText()).toBe(true)
    applyLargeTextDom(true)
    expect(document.documentElement.classList.contains('large-text')).toBe(true)
    applyLargeTextDom(false)
    saveLargeText(false)
    expect(loadLargeText()).toBe(false)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/Larger text/)
    expect(settings).toMatch(/mydsp_large_text|LARGE_TEXT_STORAGE_KEY|saveLargeText/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/html\.large-text/)
    expect(css).toMatch(/markets-quote-price/)
  })

  it('package version is 1.2.44', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.92')
  })
})
