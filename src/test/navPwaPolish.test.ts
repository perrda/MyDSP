import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('nav / PWA polish batch', () => {
  it('truncates bottom-nav labels and supports landscape icon-only mode', () => {
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/bottom-nav-link-label/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/orientation:\s*landscape/)
    expect(css).toMatch(/bottom-nav--tablet/)
  })

  it('audits modal safe-area insets on all edges', () => {
    const src = readFileSync(resolve(__dirname, '../components/ui/Modal.tsx'), 'utf8')
    expect(src).toMatch(/safe-area-inset-top/)
    expect(src).toMatch(/safe-area-inset-bottom/)
    expect(src).toMatch(/safe-area-inset-left/)
    expect(src).toMatch(/safe-area-inset-right/)
  })

  it('uses an accent progress ring for pull-to-refresh', () => {
    const src = readFileSync(resolve(__dirname, '../components/ui/PullToRefresh.tsx'), 'utf8')
    expect(src).toMatch(/ptr-ring/)
  })

  it('shortens offline banner copy on phone', () => {
    const src = readFileSync(resolve(__dirname, '../components/InstallPrompt.tsx'), 'utf8')
    expect(src).toMatch(/md:hidden/)
    expect(src).toMatch(/mydsp-sync-applied/)
    expect(src).toMatch(/SYNC_COACH_KEY|mydsp_a2hs_after_sync/)
  })

  it('mounts sync conflict sheet and keyboard shortcuts help', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')
    expect(app).toMatch(/SyncConflictSheet/)
    expect(app).toMatch(/KeyboardShortcutsHelp/)
  })
})
