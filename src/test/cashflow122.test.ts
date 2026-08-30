import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MONEY_DOORS } from '../domain/hubPages'
import { PRIMARY_NAV } from '../domain/primaryNav'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { resolveBottomNavItems } from '../domain/bottomNav'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.122 cashflow', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.127')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.127')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.127',
      '1.2.126',
      '1.2.125',
      '1.2.124',
      '1.2.123',
    ])
  })

  it('wires a real /cashflow page (Money cockpit leftover opens it)', () => {
    expect(MONEY_DOORS.map((d) => d.label)).toEqual(['Spend', 'Holdings', 'Tax', 'Import'])
    const app = read('../App.tsx')
    expect(app).toMatch(/path="cashflow" element=\{<CashflowPage/)
    expect(app).toMatch(/pages\/CashflowPage/)
    const page = read('../pages/CashflowPage.tsx')
    expect(page).toMatch(/buildCashflowStory/)
    expect(page).toMatch(/hasCashflowSources/)
    expect(page).toMatch(/CashflowChart/)
    expect(page).toMatch(/data-testid="cashflow-story"/)
    expect(page).toMatch(/need two months/i)
    expect(page).not.toMatch(/SYNC_KEY/)
    expect(page).not.toMatch(/thumb-cta-bar/)
  })

  it('reuses recurring, spending, budgets, and runway — no second ledger', () => {
    const domain = read('../domain/cashflow.ts')
    expect(domain).toMatch(/from '\.\/budgetChart'/)
    expect(domain).toMatch(/from '\.\/recurringHelpers'/)
    expect(domain).toMatch(/from '\.\/calc'/)
    expect(domain).toMatch(/calcCash/)
    expect(domain).toMatch(/monthlyRecurringOut/)
    expect(domain).toMatch(/isBudgetSpend/)
    expect(domain).toMatch(/Not a second ledger/)
    expect(domain).not.toMatch(/estimateMonthlyExpenses/)
    expect(domain).not.toMatch(/leftoverRunwayMonths/)
    expect(domain).not.toMatch(/POSITIVE_INFINITY/)
    expect(domain).not.toMatch(/SYNC_KEY/)
    expect(domain).not.toMatch(/localStorage/)
  })

  it('one runway and one leftover book — no 99+ vs bills split', () => {
    const page = read('../pages/CashflowPage.tsx')
    expect(page).toMatch(/story\.runway\?\.months/)
    expect(page).toMatch(/Stables/)
    expect(page).toMatch(/not a bank GBP pot/)
    expect(page).not.toMatch(/Bills runway/)
    expect(page).not.toMatch(/leftover holds/)
    expect(page).not.toMatch(/Cash lasts/)
    const helpers = read('../domain/recurringHelpers.ts')
    expect(helpers).toMatch(/isRecurringIncome/)
    expect(helpers).toMatch(/monthlyRecurringOut/)
    expect(helpers).toMatch(/Income rows are not an expense/)
  })

  it('Today keeps one quiet runway line that opens Cashflow', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/to="\/cashflow"/)
    expect(dash).toMatch(/data-testid="today-cash-runway"/)
    expect(dash).toMatch(/buildCashflowRunway/)
    expect(dash).toMatch(/formatRunwayMonths/)
    expect(dash).not.toMatch(/monthlyRecurringTotal/)
    expect(dash).not.toMatch(/cashflow-story/)
    expect(dash).not.toMatch(/CashflowChart/)
  })

  it('five-door nav stays Today · Markets · Money · Plan · Household', () => {
    expect(PRIMARY_NAV.map((i) => i.label)).toEqual([
      'Today',
      'Markets',
      'Money',
      'Plan',
      'Household',
    ])
    expect(resolveBottomNavItems().map((i) => i.to)).toEqual([
      '/',
      '/markets',
      '/money',
      '/plan',
      '/household',
    ])
  })

  it('does not reopen CGT, identity, PIN, or real-vs-demo', () => {
    const page = read('../pages/CashflowPage.tsx')
    expect(page).not.toMatch(/real-vs-demo|realVsDemo|identity|CGT|pinLock/i)
    const domain = read('../domain/cashflow.ts')
    expect(domain).not.toMatch(/real-vs-demo|identity|CGT|pinLock/i)
  })
})
