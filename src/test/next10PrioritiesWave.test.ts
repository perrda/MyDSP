import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const readPage = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next10 priorities wave (v1.2.109)', () => {
  it('0: package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.109')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.109')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.109',
      '1.2.108',
      '1.2.107',
      '1.2.106',
      '1.2.105',
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
    expect(dash).toMatch(/to: `\/recurring\?focus=\$\{bill\.id\}`/)
    expect(dash).toMatch(/to=\{`\/recurring\?focus=\$\{card\.bill\.id\}`\}/)
    expect(dash).toMatch(/to=\{`\/recurring\?focus=\$\{r\.id\}`\}/)
    expect(dash).toMatch(/data-testid="today-money-pulse"/)
    expect(dash).toMatch(/to="\/history"/)
    expect(dash).toMatch(/data-testid="today-career-pulse"/)
    expect(dash).toMatch(/to="\/jobs"/)
  })

  it('4: Compare week-Δ honesty note', () => {
    const compare = readPage('ComparePage.tsx')
    expect(compare).toMatch(/compare-week-delta-note/)
    expect(compare).toMatch(/data-testid="compare-week-delta-note"/)
    expect(compare).toMatch(/first Compare visit this week/)
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
})
