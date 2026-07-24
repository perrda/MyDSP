import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('Markets minimal toolbar · seg buttons (v1.2.94)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.100')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.100')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.100',
      '1.2.99',
      '1.2.98',
      '1.2.97',
      '1.2.96',
    ])
  })

  it('view controls use compact ui-seg (not oversized secondary)', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-view-controls/)
    expect(page).toMatch(/ui-seg markets-density/)
    expect(page).toMatch(/ui-seg markets-expand-all/)
    expect(page).toMatch(/ui-seg markets-collapse-all/)
    expect(page).toMatch(/ui-seg markets-sort/)
    expect(page).toMatch(/ui-seg markets-sections-sort/)
    expect(page).not.toMatch(
      /btn-secondary inline-flex items-center gap-2 markets-sort/,
    )
    expect(page).not.toMatch(/markets-retry-all-stale/)
    expect(page).not.toMatch(/Retry all stale/)
  })

  it('section jumps + timeframes use ui-seg buttons', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-section-jump-chip ui-seg/)
    expect(page).toMatch(/ui-seg tabular-nums markets-timeframe/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.ui-seg\b/)
    expect(css).toMatch(/\.ui-seg-group\b/)
  })

  it('News / YouTube Sort and Today / Jobs jumps share ui-seg', () => {
    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(news).toMatch(/className=\{`ui-seg\$\{sorting/)
    expect(yt).toMatch(/className=\{`ui-seg\$\{sorting/)
    expect(dash).toMatch(/today-section-jump-chip ui-seg/)
    expect(jobs).toMatch(/jobs-kanban-jump-chips ui-seg-group/)
    expect(jobs).toMatch(/jobs-follow-up-chip ui-seg/)
  })
})
