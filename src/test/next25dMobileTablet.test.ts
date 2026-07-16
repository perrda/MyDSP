import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('next25d mobile / tablet items', () => {
  it('11: Overview bottom-nav double tap scrolls Today main content to top', () => {
    const bottomNav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(bottomNav).toMatch(/lastOverviewTap/)
    expect(bottomNav).toMatch(/scrollTodayToTop/)
    expect(bottomNav).toMatch(/document\.getElementById\('main-content'\)/)
    expect(bottomNav).toMatch(/pathname === '\/'/)
  })

  it('13: Jobs pipeline mini-card taps focus Kanban by stage', () => {
    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(jobs).toMatch(/jobs-pipeline-mini/)
    expect(jobs).toMatch(/jumpToPipelineStage/)
    expect(jobs).toMatch(/pipelineFocus/)
    expect(jobs).toMatch(/data-kanban-stage/)
    expect(jobs).toMatch(/scrollIntoView\(\{ behavior: 'smooth'/)
  })

  it('14: Settings sync conflict FAB jumps to the conflict panel', () => {
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/settings-sync-conflict-fab/)
    expect(settings).toMatch(/pendingConflictCount/)
    expect(settings).toMatch(/sync-conflicts-panel/)
    expect(settings).toMatch(/Review \{pendingConflictCount\} sync conflict/)
  })

  it('15: OverflowMenu uses a full-screen sheet below sm', () => {
    const menu = readFileSync(resolve(__dirname, '../components/ui/OverflowMenu.tsx'), 'utf8')
    expect(menu).toMatch(/overflow-menu-sheet/)
    expect(menu).toMatch(/fixed inset-0/)
    expect(menu).toMatch(/sm:absolute/)
    expect(menu).toMatch(/Close/)
  })

  it('16: Today bills strip reuses SwipeBillRow for Mark paid / Skip', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const swipe = readFileSync(resolve(__dirname, '../components/ui/SwipeBillRow.tsx'), 'utf8')
    expect(dashboard).toMatch(/SwipeBillRow/)
    expect(dashboard).toMatch(/today-bills-strip/)
    expect(swipe).toMatch(/Mark paid/)
    expect(swipe).toMatch(/Skip/)
  })

  it('20: Compare shows per-portfolio quote age chips', () => {
    const compare = readFileSync(resolve(__dirname, '../pages/ComparePage.tsx'), 'utf8')
    expect(compare).toMatch(/compare-quote-age-chip/)
    expect(compare).toMatch(/quoteAgeLabel/)
    expect(compare).toMatch(/as of \{portfolioQuoteAges\.get\(r\.id\)/)
    expect(compare).toMatch(/lastPriceUpdate/)
  })
})
