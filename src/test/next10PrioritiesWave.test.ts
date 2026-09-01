import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const readPage = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next10 priorities wave (retained in v1.2.110 tip)', () => {
  it('0: package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.153')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.153')
    expect(RELEASE_NOTES.some((e) => e.version === '1.2.109')).toBe(true)
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.153',
      '1.2.152',
      '1.2.151',
      '1.2.150',
      '1.2.149',
    ])
  })

  it('1: Spending ?highlight= deep-link scroll + row ids', () => {
    const page = readPage('SpendingPage.tsx')
    expect(page).toMatch(/searchParams\.get\('highlight'\)/)
    expect(page).toMatch(/spending-row-\$\{/)
    expect(page).toMatch(/data-testid=\{`spending-row-\$\{/)
    expect(page).toMatch(/todo-focus-ring/)
  })

  it('2: Recurring ?focus= deep-link scroll + row ids', () => {
    const page = readPage('RecurringPage.tsx')
    expect(page).toMatch(/searchParams\.get\('focus'\)/)
    expect(page).toMatch(/recurring-row-\$\{/)
    expect(page).toMatch(/data-testid=\{`recurring-row-\$\{/)
  })

  it('3: Dashboard Today bill + pulse deep-links', () => {
    const dash = readPage('Dashboard.tsx')
    expect(dash).toMatch(/recurringFocusUrl/)
    expect(dash).toMatch(/from '\.\.\/domain\/deepLinks'/)
    expect(dash).toMatch(/to: recurringFocusUrl\(bill\.id\)/)
    expect(dash).toMatch(/to=\{recurringFocusUrl\(card\.bill\.id\)\}/)
    expect(dash).toMatch(/to=\{recurringFocusUrl\(r\.id\)\}/)
    expect(dash).toMatch(/data-testid="today-money-pulse"/)
    expect(dash).toMatch(/to="\/history"/)
    expect(dash).toMatch(/data-testid="today-career-pulse"/)
    expect(dash).toMatch(/to="\/jobs"/)
  })

  it('4: Compare week-Δ honesty note', () => {
    const compare = readPage('ComparePage.tsx')
    expect(compare).toMatch(/compare-week-delta-note/)
    expect(compare).toMatch(/data-testid="compare-week-delta-note"/)
    expect(compare).toMatch(/previous-week snapshot/)
    expect(compare).not.toMatch(/first Compare visit this week/)
  })

  it('5: Liability detail also posts to Spending', () => {
    const liability = readPage('LiabilityDetailPage.tsx')
    const recurring = readFileSync(resolve(__dirname, '../domain/recurringActions.ts'), 'utf8')
    expect(liability).toMatch(/appendSpendingEntry/)
    expect(liability).toMatch(/Also post to Spending/)
    expect(recurring).toMatch(/export function appendSpendingEntry/)
  })

  it('6: Markets price alert deep-link helper', () => {
    const alerts = readFileSync(resolve(__dirname, '../domain/priceAlerts.ts'), 'utf8')
    expect(alerts).toMatch(/export function priceAlertActionForSymbol/)
    expect(alerts).toMatch(/priceAlertActionForSymbol\(/)
  })

  it('7: Import honesty banner for skipped income', () => {
    const imp = readPage('EnhancedImportPage.tsx')
    expect(imp).toMatch(/data-testid="import-honesty-banner"/)
    expect(imp).toMatch(/Expenses-only by default/)
    expect(imp).toMatch(/Import income rows/)
  })

  it('8: Jobs calendar strip ICS download', () => {
    const jobs = readPage('JobsPage.tsx')
    const calendar = readFileSync(resolve(__dirname, '../domain/jobCalendar.ts'), 'utf8')
    expect(jobs).toMatch(/data-testid="jobs-calendar-ics"/)
    expect(jobs).toMatch(/Add to calendar/)
    expect(jobs).toMatch(/downloadJobEventIcs/)
    expect(calendar).toMatch(/BEGIN:VCALENDAR/)
    expect(calendar).toMatch(/BEGIN:VEVENT/)
  })

  it('9: High-traffic pages drop fixed thumb CTA bars', () => {
    for (const name of [
      'EquitiesPage.tsx',
      'CryptoPage.tsx',
      'NewsPage.tsx',
      'YouTubePage.tsx',
      'HistoryPage.tsx',
      'Dashboard.tsx',
      'ComparePage.tsx',
    ] as const) {
      expect(readPage(name)).not.toMatch(/className="thumb-cta-bar"/)
    }
  })

  it('10: Markets Ownership/Alerts/Types live under Filters disclosure', () => {
    const markets = readPage('MarketsPage.tsx')
    expect(markets).toMatch(/\['filters', 'Filters'/)
    expect(markets).toMatch(/toolbarPanel === 'filters'/)
    expect(markets).toMatch(/data-testid="markets-panel-body-filters"/)
    expect(markets).toMatch(/All ownership/)
    expect(markets).toMatch(/markets-panel-toggle--filtered/)
  })

  it('11: Holdings list rows never nowrap-crush identity over Cost/P&L', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.holdings-list-row\s*\{/)
    expect(css).toMatch(/holdings-list-row__identity/)
    expect(css).toMatch(/holdings-list-row__metrics/)

    const menu = readFileSync(
      resolve(__dirname, '../components/ui/OverflowMenu.tsx'),
      'utf8',
    )
    expect(menu).toMatch(/compact\?: boolean/)
    expect(menu).toMatch(/data-overflow-compact/)

    for (const name of ['EquitiesPage.tsx', 'CryptoPage.tsx'] as const) {
      const page = readPage(name)
      expect(page).toMatch(/holdings-list-row/)
      expect(page).toMatch(/compact\b/)
      expect(page).not.toMatch(/md:flex-nowrap/)
      expect(page).not.toMatch(/leading=\{/)
    }

    const markets = readPage('MarketsPage.tsx')
    expect(markets).toMatch(/<OverflowMenu[\s\S]*?compact/)

    const rule = readFileSync(
      resolve(__dirname, '../../.cursor/rules/no-text-overlap.mdc'),
      'utf8',
    )
    expect(rule).toMatch(/alwaysApply:\s*true/)
    expect(rule).toMatch(/OverflowMenu/)
    expect(rule).toMatch(/holdings-list-row/)
  })

  it('12: Page headers are resize-safe (stack + compact PagePrimaryActions)', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.page-header\s*\{/)
    expect(css).toMatch(/page-header__copy/)
    expect(css).toMatch(/page-header__action/)
    expect(css).toMatch(/min-width:\s*min\(100%,\s*16rem\)/)

    const header = readFileSync(
      resolve(__dirname, '../components/ui/PageHeader.tsx'),
      'utf8',
    )
    expect(header).toMatch(/page-header__copy/)
    expect(header).not.toMatch(/sm:flex-row/)

    const primary = readFileSync(
      resolve(__dirname, '../components/ui/PagePrimaryActions.tsx'),
      'utf8',
    )
    expect(primary).toMatch(/compact\s*=\s*true/)

    for (const name of [
      'EquitiesPage.tsx',
      'CryptoPage.tsx',
      'ComparePage.tsx',
      'HistoryPage.tsx',
      'NewsPage.tsx',
      'YouTubePage.tsx',
    ] as const) {
      const page = readPage(name)
      expect(page).toMatch(/PagePrimaryActions/)
      expect(page).not.toMatch(/md:flex-nowrap/)
    }

    const resizeRule = readFileSync(
      resolve(__dirname, '../../.cursor/rules/resize-safe-layouts.mdc'),
      'utf8',
    )
    expect(resizeRule).toMatch(/alwaysApply:\s*true/)
    expect(resizeRule).toMatch(/PagePrimaryActions/)
    expect(resizeRule).toMatch(/page-header/)
  })
})
