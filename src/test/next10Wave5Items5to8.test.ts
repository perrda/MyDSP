import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}.tsx`), 'utf8')

describe('next-10 wave 5 items 5–8', () => {
  it('can mirror a staking reward into the cash ledger with honest tax copy', () => {
    const staking = page('StakingPage')
    expect(staking).toMatch(/Also log cash income/)
    expect(staking).toMatch(/appendSpendingEntry/)
    expect(staking).toMatch(/reward\.amount \* priceAtTime/)
    expect(staking).toMatch(/category: 'income'/)
    expect(staking).toMatch(/spendingHighlightUrl/)
    expect(staking).toMatch(/cash ledger only/i)
    expect(staking).toMatch(/does not (perform a|calculate) tax/i)
  })

  it('bridges a job to a filtered, prefilled document vault', () => {
    const job = page('JobDetailPage')
    const documents = page('DocumentsPage')
    expect(job).toMatch(/Open document vault/)
    expect(job).toMatch(/documents\?linkedKind=job&linkedId=/)
    expect(documents).toMatch(/useSearchParams/)
    expect(documents).toMatch(/document\.linkedKind === queryLinkedKind/)
    expect(documents).toMatch(/linkedKind: queryLinkedKind/)
    expect(documents).toMatch(/linkedId: queryLinkedId/)
  })

  it('exposes per-portfolio named scenario save, load, and delete actions', () => {
    const analytics = page('PredictiveAnalyticsPage')
    expect(analytics).toMatch(/activeId/)
    expect(analytics).toMatch(/saveAnalyticsScenario/)
    expect(analytics).toMatch(/loadAnalyticsScenarios/)
    expect(analytics).toMatch(/deleteAnalyticsScenario/)
    expect(analytics).toMatch(/Named scenarios/)
  })

  it('keeps an inline broker import report with concrete skip reasons', () => {
    const equities = page('EquitiesPage')
    expect(equities).toMatch(/brokerImportReport/)
    expect(equities).toMatch(/Broker import report/)
    expect(equities).toMatch(/skipReasons/)
    expect(equities).toMatch(/Skipped \/ not imported/)
    expect(equities).toMatch(/data-testid="import-honesty-banner"/)
  })
})
