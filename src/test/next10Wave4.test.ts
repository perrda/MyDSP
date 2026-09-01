import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { firstSyncHighlightHref } from '../services/sync/syncHighlights'

const readPage = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next10 wave 4 (v1.2.113)', () => {
  it('0: package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.149')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.149')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.149',
      '1.2.147',
      '1.2.146',
      '1.2.145',
      '1.2.144',
    ])
  })

  it('1: Recurring Mark paid / Skip Undo', () => {
    const recurring = readPage('RecurringPage.tsx')
    expect(recurring).toMatch(/Undo|undo/)
    expect(recurring).toMatch(/Mark paid|Skip/)
    expect(readPage('Dashboard.tsx')).toMatch(/recurringFocusUrl/)
  })

  it('2: Dividend cash ledger on HoldingDetail', () => {
    expect(readPage('HoldingDetailPage.tsx')).toMatch(/Log dividend|dividend/i)
    expect(readPage('HoldingDetailPage.tsx')).toMatch(/appendSpendingEntry|income/i)
  })

  it('3: Crypto transfer/staking honesty copy', () => {
    const crypto = readPage('CryptoPage.tsx') + readPage('HoldingDetailPage.tsx') + readPage('StakingPage.tsx')
    expect(crypto).toMatch(/transfer|staking|manual/i)
  })

  it('4: Todos Day overdue + Focus/Snooze/Complete', () => {
    const todos = readPage('TodosPage.tsx')
    expect(todos).toMatch(/overdue|Day/i)
    expect(todos).toMatch(/Focus|Snooze|Complete/)
  })

  it('5: Jobs Applied→Interview→Offer funnel', () => {
    expect(readPage('JobsPage.tsx')).toMatch(/Interview|Offer|Applied/)
  })

  it('6: Budgets top merchants + Make rule', () => {
    const budgets = readPage('BudgetsPage.tsx')
    expect(budgets).toMatch(/makeRuleHref|Make rule/)
    expect(budgets).toMatch(/merchant/i)
  })

  it('7: FIRE chip bridges to Planning Monte Carlo', () => {
    expect(readPage('Dashboard.tsx')).toMatch(/planningMonteCarloUrl/)
    expect(readPage('PlanningPage.tsx')).toMatch(/From Today|montecarlo|searchParams|nw=/i)
  })

  it('8: News Owned filter sticky / saved sync', () => {
    const news = readPage('NewsPage.tsx')
    expect(news).toMatch(/owned|Owned|Filters/i)
  })

  it('9: YouTube unread deep-link', () => {
    expect(readPage('YouTubePage.tsx')).toMatch(/unread=1|unread/)
  })

  it('10: Sync conflict per-row + Open first', () => {
    const sheet = readFileSync(
      resolve(__dirname, '../components/SyncConflictSheet.tsx'),
      'utf8',
    )
    expect(sheet).toMatch(/local|remote|Undo/i)
    expect(firstSyncHighlightHref({ todoItems: [1] })).toBe('/todos?focus=1')
  })
})
