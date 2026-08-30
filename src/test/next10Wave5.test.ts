import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { suggestMerchantRules } from '../domain/merchantRules'
import {
  DEFAULT_TODAY_SECTION_ORDER,
  loadTodayLayout,
  saveTodayLayout,
} from '../storage/todayLayoutStore'
import type { MerchantRule, SpendingEntry } from '../domain/types'

const readPage = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next10 wave 5 tip harness (v1.2.114)', () => {
  it('0: package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.143')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.143')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.143',
      '1.2.141',
      '1.2.140',
      '1.2.139',
      '1.2.137',
    ])
  })

  it('1: Today layout reorder/hide with LWW store', () => {
    localStorage.clear()
    const saved = saveTodayLayout(
      { order: ['goals', ...DEFAULT_TODAY_SECTION_ORDER.filter((id) => id !== 'goals')], hidden: ['media'] },
      { markDirty: false },
    )
    expect(loadTodayLayout().order[0]).toBe('goals')
    expect(saved.hidden).toContain('media')
    expect(readPage('Dashboard.tsx')).toMatch(/ReorderList|todaySectionOrder|Customize/)
  })

  it('2: Merchant rule suggestions on Spending', () => {
    const spending: SpendingEntry[] = [
      { id: 1, date: '2026-07-01', amount: 4, description: 'Pret', category: 'food', method: 'debit' },
      { id: 2, date: '2026-07-02', amount: 5, description: 'Pret', category: 'food', method: 'debit' },
    ]
    const rules: MerchantRule[] = []
    expect(suggestMerchantRules(spending, rules)[0]?.pattern).toBe('Pret')
    expect(readPage('SpendingPage.tsx')).toMatch(/Suggested rules|makeRuleHref/)
  })

  it('3: Liability due calendar → Mark paid', () => {
    expect(readPage('LiabilitiesPage.tsx')).toMatch(/Due calendar|payment=1/)
  })

  it('4: Equities corporate-action strip', () => {
    expect(readPage('EquitiesPage.tsx')).toMatch(/equities-corporate-actions-due|#corporate-action/)
  })

  it('5: Staking reward → optional Spending income', () => {
    expect(readPage('StakingPage.tsx')).toMatch(/Also log cash income|appendSpendingEntry/)
  })

  it('6: Jobs → Documents vault deep-link', () => {
    expect(readPage('JobDetailPage.tsx')).toMatch(/documents\?linkedKind=job&linkedId=/)
    expect(readPage('DocumentsPage.tsx')).toMatch(/linkedKind|queryLinkedKind/)
  })

  it('7: Analytics named scenarios', () => {
    expect(readPage('PredictiveAnalyticsPage.tsx')).toMatch(
      /saveAnalyticsScenario|Named scenarios/,
    )
  })

  it('8: Broker CSV import honesty banner', () => {
    expect(readPage('EquitiesPage.tsx')).toMatch(
      /brokerImportReport|import-honesty-banner|Broker import report/,
    )
  })

  it('9: Bottom nav is the fixed five-door IA', () => {
    const toolbar = readFileSync(
      resolve(__dirname, '../components/layout/ToolbarControls.tsx'),
      'utf8',
    )
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(toolbar).not.toMatch(/mydsp-open-bottom-nav-editor/)
    expect(nav).toMatch(/resolveBottomNavItems/)
    expect(nav).toMatch(/isDigestLongPressItem/)
  })

  it('10: focus-visible + reduced-motion a11y', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/focus-visible/)
    expect(css).toMatch(/prefers-reduced-motion/)
  })
})
