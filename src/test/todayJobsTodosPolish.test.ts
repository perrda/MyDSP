import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Today / Jobs / Todos polish batch (31–40)', () => {
  it('31: Today hub has one primary focus card and simplified Jump-in', () => {
    const src = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(src).toMatch(/today-focus-card/)
    expect(src).toMatch(/focusTodo/)
    expect(src).toMatch(/topMover/)
    expect(src).toMatch(/Jump in/)
    expect(src).toMatch(/QUICK_PRIMARY/)
  })

  it('32: Todos deep-link focus scrolls and pulses the ring', () => {
    const src = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(src).toMatch(/searchParams\.get\('focus'\)/)
    expect(src).toMatch(/todo-focus-ring/)
    expect(src).toMatch(/scrollIntoView/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/todo-focus-pulse/)
  })

  it('33: Jobs Kanban uses horizontal scroll-snap on phone', () => {
    const src = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(src).toMatch(/snap-x/)
    expect(src).toMatch(/snap-start/)
    expect(src).toMatch(/kanban-snap-scroll/)
  })

  it('34: Job detail has a safe-area sticky action bar above bottom nav', () => {
    const src = readFileSync(resolve(__dirname, '../pages/JobDetailPage.tsx'), 'utf8')
    expect(src).toMatch(/job-detail-action-bar/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/job-detail-action-bar/)
    expect(css).toMatch(/has-bottom-nav \.job-detail-action-bar/)
  })

  it('35: Spending phone month picker uses type=month and min-h-11 targets', () => {
    const src = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')
    expect(src).toMatch(/type=\"month\"/)
    expect(src).toMatch(/spending-month-picker/)
    expect(src).toMatch(/min-h-11/)
  })

  it('36: CollapsibleFilters opens a Filters sheet under 640px', () => {
    const src = readFileSync(resolve(__dirname, '../components/ui/CollapsibleFilters.tsx'), 'utf8')
    expect(src).toMatch(/max-width:\s*639px/)
    expect(src).toMatch(/filters-sheet/)
    expect(src).toMatch(/min-h-11/)
    expect(src).toMatch(/Filters/)
  })

  it('37: Todos empty state promotes OCR / Screenshot as primary CTA', () => {
    const src = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(src).toMatch(/From Screenshot \(OCR\)/)
    expect(src).toMatch(/label:\s*'From Screenshot \(OCR\)'/)
    expect(src).toMatch(/btn-primary btn-sm[\s\S]*Screenshot/)
  })

  it('38: Completed todos collapse by default on phone', () => {
    const src = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(src).toMatch(/todos-completed-section/)
    expect(src).toMatch(/min-width:\s*768px/)
    expect(src).toMatch(/completedOpen/)
  })

  it('39: News and YouTube expose unread chips and Load more', () => {
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(news).toMatch(/news-unread-chip/)
    expect(news).toMatch(/Load more/)
    expect(news).toMatch(/mydsp_news_seen_at/)
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(yt).toMatch(/youtube-unread-chip/)
    expect(yt).toMatch(/Load more/)
    expect(yt).toMatch(/mydsp_youtube_seen_at/)
  })

  it('40: Trips and Goals use denser cards in iPad landscape', () => {
    const trips = readFileSync(resolve(__dirname, '../pages/TripsPage.tsx'), 'utf8')
    expect(trips).toMatch(/trips-list-density/)
    expect(trips).toMatch(/trips-density-card/)
    const goals = readFileSync(resolve(__dirname, '../pages/Goals.tsx'), 'utf8')
    expect(goals).toMatch(/goals-list-density/)
    expect(goals).toMatch(/goals-density-card/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/trips-list-density/)
    expect(css).toMatch(/orientation:\s*landscape/)
  })
})
