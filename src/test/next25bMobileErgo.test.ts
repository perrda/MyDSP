import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isSyncTradeBackupSuccess,
  triggerSuccessFlash,
} from '../utils/successFlash'
import { shouldShowBottomNav } from '../hooks/useShowBottomNav'

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

describe('next25b mobile ergonomics (11–15)', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
    document.documentElement.classList.remove('success-haptic-flash')
  })

  afterEach(() => {
    mem.clear()
    document.documentElement.classList.remove('success-haptic-flash')
    vi.restoreAllMocks()
  })

  it('11: thumb-cta-bar + PageHeader phone order utilities exist', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.thumb-cta-bar/)
    expect(css).toMatch(/\.page-header__action/)
    expect(css).toMatch(/max-width:\s*639px/)

    const header = readFileSync(resolve(__dirname, '../components/ui/PageHeader.tsx'), 'utf8')
    expect(header).toMatch(/page-header/)
    expect(header).toMatch(/page-header__action/)

    const todos = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(todos).toMatch(/thumb-cta-bar/)
    expect(jobs).toMatch(/thumb-cta-bar/)
    expect(markets).toMatch(/thumb-cta-bar/)
  })

  it('12: Jobs column picker sheet jumps to kanban column', () => {
    const src = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(src).toMatch(/columnPickerOpen/)
    expect(src).toMatch(/Jump to column/)
    expect(src).toMatch(/jumpToKanbanColumn/)
    expect(src).toMatch(/data-kanban-column/)
    expect(src).toMatch(/scrollIntoView/)
    expect(src).toMatch(/Columns3/)
  })

  it('13: Todos bulk-select mode toggles Select with Complete / Move / Delete', () => {
    const src = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(src).toMatch(/selectMode/)
    expect(src).toMatch(/\{selectMode \? 'Done' : 'Select'\}/)
    expect(src).toMatch(/handleBulkComplete/)
    expect(src).toMatch(/Move list/)
    expect(src).toMatch(/handleBulkDelete/)
    expect(src).toMatch(/selectMode && selectedTodos\.size > 0/)
  })

  it('14: landscape tablet prefers sticky sidebar and hides bottom-nav', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/orientation:\s*landscape\)\s+and\s+\(min-width:\s*768px\)/)
    expect(css).toMatch(/\.app-sidebar/)
    expect(css).toMatch(/\.bottom-nav/)

    const hook = readFileSync(resolve(__dirname, '../hooks/useShowBottomNav.ts'), 'utf8')
    expect(hook).toMatch(/orientation: landscape/)
    expect(hook).toMatch(/min-width: 768px/)

    const sidebar = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')
    expect(sidebar).toMatch(/app-sidebar/)
    expect(sidebar).toMatch(/app-sidebar-backdrop/)

    // Phone-width portrait → bottom nav on
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({
        matches:
          q.includes('min-width: 1024') ? false :
          q.includes('orientation: landscape') && q.includes('min-width: 768') ? false :
          q.includes('min-width: 768') ? false :
          q.includes('hover: hover') ? false :
          false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      })),
    )
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 1, configurable: true })
    expect(shouldShowBottomNav()).toBe(true)

    // Landscape + ≥768 → desktop chrome (no bottom nav)
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({
        matches:
          q.includes('min-width: 1024') ? false :
          q.includes('orientation: landscape') && q.includes('min-width: 768') ? true :
          q.includes('min-width: 768') ? true :
          false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      })),
    )
    expect(shouldShowBottomNav()).toBe(false)
  })

  it('15: success haptic flash is reduce-motion safe and wired to Sync/Trade/Backup', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/success-haptic-flash/)
    expect(css).toMatch(/toast-haptic-flash/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/)

    expect(isSyncTradeBackupSuccess('Full backup saved on this device.')).toBe(true)
    expect(isSyncTradeBackupSuccess('Devices synced')).toBe(true)
    expect(isSyncTradeBackupSuccess('Trade saved')).toBe(true)
    expect(isSyncTradeBackupSuccess('Glass Mode on.')).toBe(false)

    triggerSuccessFlash()
    expect(document.documentElement.classList.contains('success-haptic-flash')).toBe(true)

    const toast = readFileSync(resolve(__dirname, '../components/ui/Toast.tsx'), 'utf8')
    expect(toast).toMatch(/toast-haptic-flash/)
    const provider = readFileSync(resolve(__dirname, '../components/ToastProvider.tsx'), 'utf8')
    expect(provider).toMatch(/triggerSuccessFlash/)
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/isSyncTradeBackupSuccess/)
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/triggerSuccessFlash/)
  })

  it('package version is 1.2.44', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.75')
  })
})
