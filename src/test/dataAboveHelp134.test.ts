import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.134 data above help chrome', () => {
  it('Crypto KPIs and mix sit above Connect exchange / search / concentration', () => {
    const crypto = read('../pages/CryptoPage.tsx')
    const kpi = crypto.indexOf('fluid-metric-grid fluid-metric-grid--3')
    const mix = crypto.indexOf('eyebrow="Mix"')
    const list = crypto.indexOf('holdings-master-detail crypto-master-detail')
    const exchange = crypto.indexOf('data-testid="crypto-exchange-stub"')
    const note = crypto.indexOf('crypto-manual-ledgers-note')
    const search = crypto.indexOf('Search crypto holdings by symbol or name')
    const concentration = crypto.indexOf('portfolio-concentration-banner')
    expect(kpi).toBeGreaterThan(-1)
    expect(mix).toBeGreaterThan(kpi)
    expect(list).toBeGreaterThan(mix)
    expect(exchange).toBeGreaterThan(list)
    expect(note).toBeGreaterThan(exchange)
    expect(search).toBeGreaterThan(note)
    expect(concentration).toBeGreaterThan(search)
  })

  it('Equities KPIs sit above search chrome', () => {
    const eq = read('../pages/EquitiesPage.tsx')
    const kpi = eq.indexOf('fluid-metric-grid fluid-metric-grid--3')
    const mix = eq.indexOf('eyebrow="Mix"')
    const list = eq.indexOf('holdings-master-detail equities-master-detail')
    const search = eq.indexOf('Search equity holdings by symbol or name')
    expect(kpi).toBeGreaterThan(-1)
    expect(mix).toBeGreaterThan(kpi)
    expect(list).toBeGreaterThan(mix)
    expect(search).toBeGreaterThan(list)
  })

  it('Holding detail chart sits above Connect exchange', () => {
    const page = read('../pages/HoldingDetailPage.tsx')
    const chart = page.indexOf('<HoldingPriceChart')
    const exchange = page.indexOf('data-testid="crypto-exchange-stub"')
    expect(chart).toBeGreaterThan(-1)
    expect(exchange).toBeGreaterThan(chart)
  })

  it('Staking KPIs sit above the manual ledger note', () => {
    const page = read('../pages/StakingPage.tsx')
    const kpi = page.indexOf('Total rewards')
    const note = page.indexOf('staking-manual-ledger-note')
    expect(kpi).toBeGreaterThan(-1)
    expect(note).toBeGreaterThan(kpi)
  })

  it('Tax KPIs and disposals sit above export / disclaimer chrome', () => {
    const tax = read('../pages/TaxPage.tsx')
    const year = tax.indexOf('tax-sticky-toolbar')
    const table = tax.indexOf('aria-label="Disposals list"')
    const explainer = tax.indexOf('What these exports mean')
    const usNote = tax.indexOf('us-8949-heading')
    expect(year).toBeGreaterThan(-1)
    expect(table).toBeGreaterThan(year)
    expect(explainer).toBeGreaterThan(table)
    expect(usNote).toBeGreaterThan(explainer)
  })

  it('Plan unpriced banner sits after rebalance / Monte Carlo book', () => {
    const plan = read('../pages/PlanningPage.tsx')
    const kpi = plan.indexOf('Investable total')
    const banner = plan.indexOf('<UnpricedExclusionBanner')
    expect(kpi).toBeGreaterThan(-1)
    expect(banner).toBeGreaterThan(kpi)
  })

  it('Compare table and donuts sit above the week-Δ note', () => {
    const compare = read('../pages/ComparePage.tsx')
    const kpi = compare.indexOf('Combined net worth')
    const table = compare.indexOf('aria-label="Portfolio comparison"')
    const donut = compare.indexOf('Combined asset allocation')
    const note = compare.indexOf('compare-week-delta-note')
    expect(kpi).toBeGreaterThan(-1)
    expect(table).toBeGreaterThan(kpi)
    expect(donut).toBeGreaterThan(table)
    expect(note).toBeGreaterThan(donut)
  })

  it('workspace rule locks the order', () => {
    const rule = read('../../.cursor/rules/data-above-help-chrome.mdc')
    expect(rule).toMatch(/alwaysApply:\s*true/)
    expect(rule).toMatch(/book first, explanation second/)
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.134\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Data above help chrome/)
  })
})
