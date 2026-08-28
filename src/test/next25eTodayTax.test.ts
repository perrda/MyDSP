import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('next25e Today / money / tax items 16-20', () => {
  it('16: Today budget pulse shows month spent versus total budget goals and links to Budgets', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(dashboard).toMatch(/monthlyBudgetPulse/)
    expect(dashboard).toMatch(/monthlyBudgetPulseFrom/)
    expect(dashboard).toMatch(/today-budget-pulse/)
    expect(dashboard).toMatch(/totalBudget/)
    expect(dashboard).toMatch(/to="\/budgets"/)
  })

  it('17: Today cash runway estimates recurring coverage from liquid-ish net worth', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(dashboard).toMatch(/cashRunway/)
    expect(dashboard).toMatch(/today-cash-runway/)
    expect(dashboard).toMatch(/monthlyRecurring/)
    expect(dashboard).toMatch(/buildCashflowRunway/)
  })

  it('18: Spending search explicitly matches merchant, description, category, location, and notes', () => {
    const spending = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')

    expect(spending).toMatch(/matchesSpendingMerchantSearch/)
    expect(spending).toMatch(/tx\.description/)
    expect(spending).toMatch(/tx\.location/)
    expect(spending).toMatch(/tx\.notes/)
    expect(spending).toMatch(/Merchant \/ description \/ category/)
  })

  it('19: Sell trades surface a Tax disposal toast CTA and Tax consumes query prefill', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    const holdingDetail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    const tax = readFileSync(resolve(__dirname, '../pages/TaxPage.tsx'), 'utf8')

    expect(equities).toMatch(/taxDisposalHrefForEquity/)
    expect(equities).toMatch(/label: 'Tax disposal'/)
    expect(crypto).toMatch(/taxDisposalHrefForCrypto/)
    expect(crypto).toMatch(/assetType: 'crypto'/)
    expect(holdingDetail).toMatch(/buildTaxDisposalHref/)
    expect(holdingDetail).toMatch(/label: 'Tax disposal'/)
    expect(tax).toMatch(/useSearchParams/)
    expect(tax).toMatch(/searchParams\.get\('symbol'\)/)
    expect(tax).toMatch(/setOpen\(true\)/)
  })

  it('20: Today FIRE chip is derived from calcFire when fireInputs exist and are explicitly set', () => {
    const dashboard = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')

    expect(dashboard).toMatch(/calcFire/)
    expect(dashboard).toMatch(/hasExplicitFireInputs/)
    expect(dashboard).toMatch(/data\.fireInputs/)
    expect(dashboard).toMatch(/today-fire-chip/)
    expect(dashboard).toMatch(/planningMonteCarloUrl\(netWorth,\s*data\.fireInputs\.savings/)
    
    const fire = readFileSync(resolve(__dirname, '../domain/fire.ts'), 'utf8')
    expect(fire).toMatch(/hasExplicitFireInputs/)
    expect(fire).toMatch(/Check if FIRE inputs have been explicitly set/)
  })
})
