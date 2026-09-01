import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { resolveBottomNavItems } from '../domain/bottomNav'
import { PRIMARY_NAV } from '../domain/primaryNav'
import { HOUSEHOLD_DOORS, MONEY_DOORS, PLAN_DOORS } from '../domain/hubPages'
import { todayMoversEmptyCopy } from '../domain/todayMarketsCopy'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.121 UX pack', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.156')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.156')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.156',
      '1.2.155',
      '1.2.154',
      '1.2.153',
      '1.2.152',
    ])
  })

  it('1: Today fold is title then Net worth — no lede', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/gradient-text">Today</)
    expect(dash).not.toMatch(/Net worth, tasks due now/)
    expect(dash).toMatch(/Weekly backup overdue/)
  })

  it('2: Nav is Today · Markets · Money · Plan · Household — no Others dump', () => {
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
    const sidebar = read('../components/layout/Sidebar.tsx')
    expect(sidebar).toMatch(/SIDEBAR_NAV/)
    expect(sidebar).not.toMatch(/nav-others-toggle/)
    expect(sidebar).not.toMatch(/label: 'Overview'/)
    expect(MONEY_DOORS.length).toBe(4)
    expect(PLAN_DOORS.length).toBeGreaterThan(5)
    expect(HOUSEHOLD_DOORS.length).toBeGreaterThan(3)
    expect(read('../App.tsx')).toMatch(/path="money"/)
    expect(read('../App.tsx')).toMatch(/path="plan"/)
  })

  it('3: Alerts print once — card only, no hero duplicate', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/id="today-alerts"/)
    expect(dash).not.toMatch(/today-top-alert/)
    expect(dash).toMatch(/showRemindersCard[\s\S]*!showAlertsCard/)
  })

  it('4: One money story — no Budget 0% restatement card', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-hero-book-rows/)
    expect(dash).toMatch(/today-hero-row-net-worth/)
    expect(dash).toMatch(/today-hero-row-liabilities/)
    expect(dash).toMatch(/const showBudgetCard = false/)
    expect(dash).toMatch(/title="Allocation"/)
  })

  it('5: One scorebook is XP / level / unlocks (not the independent 0–1000 score)', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-scorebook/)
    expect(dash).toMatch(/\{achievements\.xp\} XP/)
    expect(dash).not.toMatch(/Financial score/)
    expect(dash).not.toMatch(/achievements\.score/)
    expect(dash).not.toMatch(/0–1000 composite/)
    const ach = read('../pages/AchievementsPage.tsx')
    expect(ach).toMatch(/label="Scorebook"/)
    expect(ach).toMatch(/evalResult\.xp\} XP/)
    expect(ach).not.toMatch(/evalResult\.score/)
    const scoreDoor = PLAN_DOORS.find((d) => d.to === '/achievements')
    expect(scoreDoor?.detail).toBe('XP, level, unlocks')
    expect(scoreDoor?.detail).not.toMatch(/Score/)
  })

  it('6: Markets and Timeline stay honest', () => {
    expect(todayMoversEmptyCopy(8)).toMatch(/8 tickers watched/)
    expect(todayMoversEmptyCopy(0)).toMatch(/No tickers/)
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/todayMoversEmptyCopy/)
    expect(dash).not.toMatch(/No fresh movers \(last 24h\)/)
    expect(dash).toMatch(/Need two snapshots before a timeline/)
    expect(dash).toMatch(/data\.history\.length >= 2/)
    expect(dash).toMatch(/todayMovers[\s\S]*MOVER_MAX_AGE_MS/)
  })

  it('7: First-device sync is one card — no SYNC_KEY', () => {
    const setup = read('../components/GettingStartedChecklist.tsx')
    expect(setup).toMatch(/today-sync-setup-card/)
    expect(setup).toMatch(/Setup \$\{doneCount\}\/\$\{coreSteps\.length\}/)
    expect(setup).not.toMatch(/SYNC_KEY/)
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/GettingStartedChecklist asCard/)
    expect(dash).not.toMatch(/today-finnhub-missing-chip/)
  })

  it('8: Markets door is left nav — no Today Markets card or header CTA', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-main-column/)
    expect(dash).not.toMatch(/today-markets-pane/)
    expect(dash).not.toMatch(/page-primary-actions/)
    expect(dash).not.toMatch(/to="\/markets" className="btn-secondary/)
  })

  it('9: Jump rail chips land after the hero — TAX has scroll-margin', () => {
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-section-jump-chips flex flex-wrap/)
    expect(dash).toMatch(/today-section-jump-tax/)
    expect(dash).not.toMatch(/today-section-jump-markets/)
    expect(dash).not.toMatch(/today-section-jump-budget/)
    const css = read('../index.css')
    expect(css).toMatch(/#today-tax,/)
    expect(css).toMatch(/scroll-margin-top/)
    expect(css).toMatch(/overscroll-behavior-y:\s*contain/)
  })

  it('10: Household is a real page; Settings is /settings', () => {
    const app = read('../App.tsx')
    expect(app).toMatch(/path="household" element=\{<FamilyPage/)
    expect(app).toMatch(/path="family" element=\{<Navigate to="\/household"/)
    const family = read('../pages/FamilyPage.tsx')
    expect(family).toMatch(/title="Household"/)
    expect(family).toMatch(/HOUSEHOLD_DOORS/)
    const launch = read('../components/LaunchRedirect.tsx')
    expect(launch).toMatch(/hashRoute/)
    expect(launch).toMatch(/Settings is always a path/)
    const markets = read('../pages/MarketsPage.tsx')
    const focus = markets.slice(markets.indexOf('Deep-link: /markets?symbol='))
    expect(focus.indexOf('if (!hit) return')).toBeLessThan(
      focus.indexOf('setSearchParams({}, { replace: true })'),
    )
  })
})
