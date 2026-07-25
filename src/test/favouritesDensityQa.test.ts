import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = () => readFileSync(resolve(__dirname, '../index.css'), 'utf8')
const page = (name: string) => readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('Favourites density / responsive QA', () => {
  it('keeps short-landscape thumb CTA bars to one horizontal row', () => {
    const src = css()

    expect(src).toMatch(/sync-trust-density-qa/)
    expect(src).toMatch(
      /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*?\.thumb-cta-bar\s*\{[\s\S]*?flex-wrap:\s*nowrap[\s\S]*?max-height:\s*3\.5rem[\s\S]*?overflow-x:\s*auto[\s\S]*?overflow-y:\s*hidden/s,
    )
    expect(src).toMatch(
      /\.thumb-cta-bar > button,\s*\.thumb-cta-bar > a,\s*\.thumb-cta-bar > span\s*\{[\s\S]*?flex:\s*0 0 auto/s,
    )
  })

  it('slims Markets phone thumb actions and unsticks short landscape filters', () => {
    const src = css()
    const markets = page('MarketsPage.tsx')

    const thumb = markets.match(
      /<div className="thumb-cta-bar" role="toolbar" aria-label="Primary markets actions">[\s\S]*?<\/div>\s*<div className="thumb-cta-bar-spacer"/,
    )?.[0]
    expect(thumb).toContain('Add equity')
    expect(thumb).toContain('Add crypto')
    expect(thumb).not.toMatch(/Retry unavailable|Refreshing data|markets-add-from-holding-thumb/)
    expect(markets).toMatch(/data-testid="markets-add-from-holding-status"/)
    expect(markets).toMatch(/data-testid="markets-sticky-filters"/)
    expect(src).toMatch(
      /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*?\.markets-sticky-filters,[\s\S]*?\.todos-sticky-filters\s*\{[\s\S]*?position:\s*static/s,
    )
  })

  it('makes Today jump chips scroll on phones and caps daily plan rows', () => {
    const src = css()
    const dashboard = page('Dashboard.tsx')

    expect(src).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.today-section-jump-chips\s*\{[\s\S]*?flex-wrap:\s*nowrap[\s\S]*?overflow-x:\s*auto/s,
    )
    expect(src).toMatch(/\.today-daily-plan-row:nth-child\(n \+ 6\)\s*\{[\s\S]*?display:\s*none/s)
    expect(dashboard).toMatch(/DAILY_PLAN_PHONE_VISIBLE_ROWS = 5/)
    expect(dashboard).toMatch(/className="today-daily-plan-row"/)
    expect(dashboard).toMatch(/today-daily-plan-see-all/)
    expect(dashboard).toMatch(/hidden sm:inline-flex/)
  })

  it('adds Todos day-view density hooks', () => {
    const src = css()
    const todos = page('TodosPage.tsx')

    expect(todos).toMatch(/data-testid="todos-day-view"/)
    expect(todos).toMatch(/todos-day-view__segment/)
    expect(todos).toMatch(/todos-day-view__items/)
    expect(src).toMatch(/\.todos-day-view\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s)
  })

  it('stacks Jobs calendar rows and keeps phone exports out of the sticky header', () => {
    const src = css()
    const jobs = page('JobsPage.tsx')

    expect(jobs).toMatch(/data-testid="jobs-calendar-strip"/)
    expect(jobs).toMatch(/jobs-calendar-row/)
    expect(jobs).toMatch(/jobs-filter-export-row/)
    expect(jobs).toMatch(/hidden sm:inline-flex[\s\S]*CSV/)
    expect(jobs).toMatch(/hidden sm:inline-flex[\s\S]*JSON/)
    expect(src).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.jobs-calendar-row\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\)/s,
    )
    expect(src).toMatch(/\.jobs-calendar-date\s*\{[\s\S]*?grid-column:\s*1 \/ -1/s)
  })

  it('tightens YouTube phone filters, status, and detail panels', () => {
    const src = css()
    const youtube = page('YouTubePage.tsx')

    expect(youtube).toMatch(/data-testid="youtube-sticky-status"/)
    expect(youtube).toMatch(/youtube-status-relative/)
    expect(youtube).toMatch(/youtube-status-absolute-date/)
    expect(youtube).toMatch(/data-testid="youtube-folders"/)
    expect(youtube).toMatch(/youtube-detail-thumbnail--with-embed/)
    expect(youtube).toMatch(/data-testid="youtube-embed"/)
    expect(src).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.youtube-folder-filters\s*\{[\s\S]*?flex-wrap:\s*nowrap[\s\S]*?overflow-x:\s*auto/s,
    )
    expect(src).toMatch(/\.youtube-status-absolute-date\s*\{[\s\S]*?display:\s*none/s)
    expect(src).toMatch(/\.youtube-master-detail-panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh[\s\S]*?overflow-y:\s*auto/s)
    expect(src).toMatch(
      /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*?\.youtube-detail-thumbnail--with-embed\s*\{[\s\S]*?display:\s*none/s,
    )
  })
})
