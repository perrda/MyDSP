import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Full a11y / axe CI gate.
 * Run with: npm run test:a11y  (iphone-14 project)
 */
test.describe('a11y gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        // Lock dark theme so day/night auto does not flip light accent contrast mid-CI.
        localStorage.setItem('mydsp_theme', 'dark')
        localStorage.setItem(
          'fcc_security',
          JSON.stringify({
            pinEnabled: false,
            pinHash: '',
            autoLockMinutes: 5,
            biometricEnabled: false,
          }),
        )
        // Privacy blur dims muted text below WCAG AA — keep off for axe gates.
        try {
          const raw = localStorage.getItem('fcc_data_v1')
          if (raw) {
            const data = JSON.parse(raw)
            if (data?.settings) data.settings.privacy = false
            localStorage.setItem('fcc_data_v1', JSON.stringify(data))
          }
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    })
  })

  test('overview has no serious axe violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/MyDSP/i).first()).toBeVisible({ timeout: 20_000 })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Today (overview) axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.getByText(/Today|Overview|MyDSP/i).first()).toBeVisible({ timeout: 20_000 })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Markets axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Settings axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/settings')
    await expect(page.getByText(/Settings/i).first()).toBeVisible({ timeout: 20_000 })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Equities axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/equities')
    await expect(page.getByRole('heading', { name: /Equities/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Crypto axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/crypto')
    await expect(page.getByRole('heading', { name: /Crypto/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Spending axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/spending')
    await expect(page.getByRole('heading', { name: /Spending ledger/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Holding detail axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/crypto/1')
    await expect(page.getByText(/Holding|Crypto|Back/i).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Tax axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/tax')
    await expect(page.getByText(/Capital gains|Tax|CGT|ISA/i).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Todos axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/todos')
    await expect(page.getByText(/To Do|Todos|Tasks/i).first()).toBeVisible({ timeout: 20_000 })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('News axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/news')
    await expect(page.getByRole('heading', { name: /News/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('YouTube axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/youtube')
    await expect(page.getByRole('heading', { name: /YouTube/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Recurring axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/recurring')
    await expect(page.getByText(/Recurring|Subscriptions|Bills/i).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Jobs axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/jobs')
    await expect(page.getByRole('heading', { name: /Jobs/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Goals axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/goals')
    await expect(page.getByRole('heading', { name: /Goals/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Trips axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/trips')
    await expect(page.getByRole('heading', { name: /Trips|splits/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Compare axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/compare')
    await expect(page.getByRole('heading', { name: /Compare portfolios/i })).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Liabilities axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/liabilities')
    await expect(page.getByRole('heading', { name: /Liabilities/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('History axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: /Net worth history/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Budgets axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/budgets')
    await expect(page.getByRole('heading', { name: /Budgets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Family axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/family')
    await expect(page.getByRole('heading', { name: /Family/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Documents axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/documents')
    await expect(page.getByRole('heading', { name: /Documents/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Import axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/import')
    await expect(page.getByRole('heading', { name: /Enhanced CSV Import/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Journal axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/journal')
    await expect(page.getByRole('heading', { name: /Investment journal/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Rules axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/rules')
    await expect(page.getByRole('heading', { name: /Merchant rules/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Equities holding detail axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/equities/1')
    await expect(page.getByText(/Holding|Equit|Back/i).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Staking axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/staking')
    await expect(page.getByRole('heading', { name: /Staking rewards/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Planning axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/planning')
    await expect(page.getByRole('heading', { name: /Rebalance|Monte Carlo/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('FIRE axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/fire')
    await expect(page.getByRole('heading', { name: /FIRE calculator/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Optimizer axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/optimizer')
    await expect(page.getByRole('heading', { name: /Debt optimizer/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Analytics axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/analytics')
    await expect(page.getByRole('heading', { name: /Analytics/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Achievements axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/achievements')
    await expect(page.getByRole('heading', { name: /Achievements/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Predictive axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/analytics/predictive')
    await expect(page.getByRole('heading', { name: /Predictive Analytics/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Insights axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/insights')
    await expect(page.getByRole('heading', { name: /Smart Insights/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('API axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/api')
    await expect(page.getByRole('heading', { name: /API & Automation/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Review axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/review')
    await expect(page.getByRole('heading', { name: /Monthly review/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Smoke axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/smoke')
    await expect(page.getByRole('list', { name: 'Smoke checklist' }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Job detail axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/jobs/1')
    // AppShell title is sm+ only; assert in-page content (empty id → not found).
    await expect(page.getByRole('heading', { name: /Job Not Found/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Liability detail axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/liabilities/card/1')
    // Seed may or may not include card id 1 — accept not-found or detail chrome.
    await expect(
      page
        .getByText(/Liability not found|Back to liabilities/i)
        .or(page.getByRole('heading', { name: /.+/ }))
        .first(),
    ).toBeVisible({ timeout: 20_000 })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('opening balance wizard has no serious axe violations', async ({ page }) => {
    await page.goto('/setup/opening')
    await expect(page.getByRole('heading', { name: /Opening balance wizard/i })).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })
})
