import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

describe('next25w — responsive / landscape polish tip (1–25 → v1.2.88)', () => {
  it('25: package + release notes are 1.2.88', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.98')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.98')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.98',
      '1.2.97',
      '1.2.96',
      '1.2.95',
      '1.2.94',
    ])
  })

  it('1–5: Review / Analytics / Optimizer / Planning keep thumb bars (Sync now removed)', () => {
    for (const file of [
      'MonthlyReviewPage.tsx',
      'AnalyticsPage.tsx',
      'OptimizerPage.tsx',
      'PlanningPage.tsx',
    ]) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).not.toMatch(/^\s*Sync now\s*$/m)
      expect(src).toMatch(/thumb-cta-bar/)
      expect(src).not.toMatch(/syncNow/)
    }
    const setup = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(setup).toMatch(/Monthly Review/)
    expect(setup).toMatch(/Debt optimizer/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/Planning-surface Sync thumbs/)
  })

  it('6–10: Markets / landscape sticky · thumb · jump · density · two-pane', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/orientation: landscape\) and \(max-height: 500px\)/)
    expect(css).toMatch(/thumb-cta-bar/)
    expect(css).toMatch(/markets-section-jump-chips/)
    expect(css).toMatch(/markets-density-trust/)
    expect(css).toMatch(/today-two-pane .today-markets-pane/)
    expect(css).toMatch(/max-height: calc\(100dvh/)
  })

  it('11–15: Todos/Jobs/Budgets/YouTube sticky · iPad device fix', () => {
    const todos = readFileSync(resolve(__dirname, '../pages/TodosPage.tsx'), 'utf8')
    expect(todos).toMatch(/todos-sticky-filters/)
    const jobs = readFileSync(resolve(__dirname, '../pages/JobsPage.tsx'), 'utf8')
    expect(jobs).toMatch(/jobs-sticky-filters/)
    const budgets = readFileSync(resolve(__dirname, '../pages/BudgetsPage.tsx'), 'utf8')
    expect(budgets).toMatch(/budgets-sticky-month/)
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(yt).toMatch(/youtube-sticky-status/)
    const pw = readFileSync(resolve(__dirname, '../../playwright.config.ts'), 'utf8')
    expect(pw).toMatch(/iPad \(gen 7\)/)
    expect(pw).toMatch(/iphone-14-landscape/)
    expect(pw).toMatch(/ipad-air-landscape/)
  })

  it('16–20: Today jump overflow · offline Retry · two-pane landscape', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/today-section-jump-chips/)
    expect(css).toMatch(/today-pulse-chips/)
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/today-offline-queue-retry/)
    expect(dash).toMatch(/data-testid="today-offline-queue-retry"/)
    expect(dash).toMatch(/orientation: landscape\) and \(min-width: 1024px\)/)
  })

  it('21–24: axe sticky + landscape · smoke Sync + sticky + landscape', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/Todos sticky filters axe/)
    expect(a11y).toMatch(/Budgets sticky month axe/)
    expect(a11y).toMatch(/Planning Sync thumb landscape axe/)
    const e2e = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(e2e).toMatch(/Review Analytics Optimizer Planning Sync thumbs/)
    expect(e2e).toMatch(/Todos Jobs Budgets YouTube sticky filters/)
    expect(e2e).toMatch(/landscape thumb CTA clears short bottom-nav/)
  })
})
