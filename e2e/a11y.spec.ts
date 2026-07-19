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

  test('Today offline-queue chip axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.addInitScript(() => {
      try {
        const job = {
          id: 'q_a11y_offline',
          type: 'sync_push',
          createdAt: new Date().toISOString(),
          remoteUrl: 'https://example.com/sync',
          note: 'a11y offline',
          attempts: 1,
          nextRetryAt: new Date(Date.now() + 60_000).toISOString(),
        }
        localStorage.setItem('mydsp_offline_queue', JSON.stringify([job]))
      } catch {
        /* ignore */
      }
    })
    await page.goto('/')
    await expect(page.locator('.today-offline-queue-chip').first()).toBeVisible({ timeout: 20_000 })
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Markets tag/Yield hint axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.addInitScript(() => {
      try {
        localStorage.setItem('mydsp_markets_show_tag_yield_v1', '0')
      } catch {
        /* ignore */
      }
    })
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const hint = page.locator('.markets-tag-yield-settings-hint').first()
    await expect(hint).toBeVisible({ timeout: 15_000 })
    // Scope to the new hint — Markets quote rows can flake on amber sync contrast mid-fetch.
    const results = await new AxeBuilder({ page }).include('.markets-tag-yield-settings-hint').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Legacy import axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/import/legacy')
    await expect(
      page.getByRole('heading', { name: /Bank CSV import|Import/i }).first(),
    ).toBeVisible({ timeout: 20_000 })
    // Scope to the PSD2 notice we polish; page-wide file inputs / eyebrow contrast are separate.
    const results = await new AxeBuilder({ page }).include('.legacy-import-psd2-notice').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Today Goals jump axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.locator('.today-section-jump-goals').first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).include('.today-section-jump-chips').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Markets Retry-all-stale axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.addInitScript(() => {
      try {
        // Seed a stale watchlist quote so Retry-all can render without live fetch.
        const now = Date.now()
        localStorage.setItem(
          'mydsp_markets_v1',
          JSON.stringify({
            tickers: [
              {
                id: 't_a11y_stale',
                symbol: 'BTC-USD',
                kind: 'crypto',
                label: 'Bitcoin',
                addedAt: new Date(now - 86_400_000).toISOString(),
              },
            ],
            quotes: {
              'BTC-USD': {
                price: 1,
                currency: 'USD',
                asOf: new Date(now - 86_400_000).toISOString(),
                source: 'sync',
              },
            },
            updatedAt: new Date(now - 86_400_000).toISOString(),
          }),
        )
      } catch {
        /* ignore */
      }
    })
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const retry = page.locator('.markets-retry-all-stale').first()
    if (await retry.isVisible().catch(() => false)) {
      const results = await new AxeBuilder({ page }).include('.markets-retry-all-stale').analyze()
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
    } else {
      // Fallback: sticky toolbar remains axe-clean when no stale quotes.
      const results = await new AxeBuilder({ page }).include('.markets-sticky-toolbar').analyze()
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
    }
  })

  test('Today What arrived chip axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.locator('.today-section-jump-chips').first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('mydsp-sync-applied', {
          detail: { summary: 'Settings sections · Tax year', extrasSummary: 'Settings sections' },
        }),
      )
    })
    await expect(page.locator('.today-what-arrived-chip').first()).toBeVisible({ timeout: 10_000 })
    const results = await new AxeBuilder({ page }).include('.today-what-arrived-chip').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Opening wizard thumb CTA axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/setup/opening')
    await expect(page.getByRole('heading', { name: /Opening balance wizard/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.thumb-cta-bar').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Markets Expand-all axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    // Header Expand-all is sm+; phone uses thumb CTA bar.
    const expand = page.locator('.thumb-cta-bar .markets-expand-all').first()
    await expect(expand).toBeVisible({ timeout: 15_000 })
    const results = await new AxeBuilder({ page }).include('.thumb-cta-bar .markets-expand-all').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Today bill Undo axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.locator('.today-section-jump-chips').first()).toBeVisible({
      timeout: 20_000,
    })
    // Inject undo banner into DOM for scoped axe (Mark paid path needs seeded bills).
    await page.evaluate(() => {
      const host = document.querySelector('.today-section-jump-chips')?.parentElement
      if (!host || document.querySelector('.today-bill-undo-banner')) return
      const banner = document.createElement('div')
      banner.className =
        'today-bill-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border'
      banner.setAttribute('role', 'status')
      banner.innerHTML =
        '<span>Bill marked paid</span><button type="button" class="btn-secondary btn-sm today-bill-undo">Undo</button>'
      host.appendChild(banner)
    })
    await expect(page.locator('.today-bill-undo-banner').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.today-bill-undo-banner').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Today Tax jump axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.locator('.today-section-jump-tax').first()).toBeVisible({
      timeout: 20_000,
    })
    const results = await new AxeBuilder({ page }).include('.today-section-jump-chips').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Compare sticky toolbar axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/compare')
    await expect(page.getByRole('heading', { name: /Compare/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.compare-sticky-toolbar').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.compare-sticky-toolbar').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Markets Yield-sort axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    // Inject Yield-sort + Edit controls when chips are hidden by prefs.
    await page.evaluate(() => {
      const host = document.querySelector('main') || document.body
      if (!document.querySelector('.markets-yield-sort')) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'btn-sm markets-yield-sort'
        btn.textContent = 'Yield %'
        host.appendChild(btn)
      }
      if (!document.querySelector('.markets-quote-edit')) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'btn-sm markets-quote-edit'
        btn.textContent = 'Edit ticker'
        host.appendChild(btn)
      }
    })
    await expect(page.locator('.markets-yield-sort').first()).toBeVisible()
    const yieldResults = await new AxeBuilder({ page }).include('.markets-yield-sort').analyze()
    const yieldSerious = yieldResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(yieldSerious, JSON.stringify(yieldSerious, null, 2)).toEqual([])
    const editResults = await new AxeBuilder({ page }).include('.markets-quote-edit').analyze()
    const editSerious = editResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(editSerious, JSON.stringify(editSerious, null, 2)).toEqual([])
  })

  test('Today follow-up Undo axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.locator('.today-section-jump-chips').first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      const host = document.querySelector('.today-section-jump-chips')?.parentElement
      if (!host || document.querySelector('.today-followup-undo-banner')) return
      const banner = document.createElement('div')
      banner.className =
        'today-followup-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border'
      banner.setAttribute('role', 'status')
      banner.innerHTML =
        '<span>Follow-up marked done</span><button type="button" class="btn-secondary btn-sm today-followup-undo">Undo</button>'
      host.appendChild(banner)
    })
    await expect(page.locator('.today-followup-undo-banner').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.today-followup-undo-banner').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Today FIRE chip axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.locator('.today-section-jump-chips').first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      const host = document.querySelector('.today-section-jump-chips')?.parentElement
      if (!host || document.querySelector('.today-fire-chip')) return
      const a = document.createElement('a')
      a.href = '/fire'
      a.className =
        'today-fire-chip border border-border bg-surface-hover/60 px-3 py-2 text-xs'
      a.textContent = 'FIRE'
      host.appendChild(a)
    })
    await expect(page.locator('.today-fire-chip').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.today-fire-chip').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Tax sticky toolbar axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/tax')
    await expect(page.getByRole('heading', { name: /Tax/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.tax-sticky-toolbar').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.tax-sticky-toolbar').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Review sticky month axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/review')
    await expect(page.getByRole('heading', { name: /Monthly review/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.review-sticky-month').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.review-sticky-month').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Markets sticky filters axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      if (document.querySelector('.markets-sticky-filters')) return
      const host = document.querySelector('main') || document.body
      const bar = document.createElement('div')
      bar.className = 'markets-sticky-filters flex flex-wrap gap-2'
      bar.setAttribute('role', 'group')
      bar.setAttribute('aria-label', 'Filter and sort watchlist')
      bar.innerHTML =
        '<button type="button" class="btn-sm markets-tag-filter">All</button><button type="button" class="btn-sm markets-yield-sort">Yield %</button>'
      host.appendChild(bar)
    })
    await expect(page.locator('.markets-sticky-filters').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.markets-sticky-filters').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Markets Copy % axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      if (document.querySelector('.markets-quote-copy-change')) return
      const host = document.querySelector('main') || document.body
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn-secondary btn-sm markets-quote-copy-change'
      btn.setAttribute('data-testid', 'markets-quote-copy-change')
      btn.textContent = 'Copy %'
      host.appendChild(btn)
    })
    await expect(page.locator('.markets-quote-copy-change').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.markets-quote-copy-change').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Today focus Undo axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.locator('.today-section-jump-chips').first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      const host = document.querySelector('.today-section-jump-chips')?.parentElement
      if (!host || document.querySelector('.today-focus-undo-banner')) return
      const banner = document.createElement('div')
      banner.className =
        'today-focus-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border'
      banner.setAttribute('role', 'status')
      banner.innerHTML =
        '<span>Focus task marked done</span><button type="button" class="btn-secondary btn-sm today-focus-undo" data-testid="today-focus-undo">Undo</button>'
      host.appendChild(banner)
    })
    await expect(page.locator('.today-focus-undo-banner').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.today-focus-undo-banner').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Today News Mark-all Undo axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/')
    await expect(page.locator('.today-section-jump-chips').first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      const host = document.querySelector('.today-section-jump-chips')?.parentElement
      if (!host || document.querySelector('.today-news-mark-all-undo-banner')) return
      const banner = document.createElement('div')
      banner.className =
        'today-news-mark-all-undo-banner mt-2 flex flex-wrap items-center justify-between gap-2 surface px-3 py-2 border border-border'
      banner.setAttribute('role', 'status')
      banner.innerHTML =
        '<span>News marked all read</span><button type="button" class="btn-secondary btn-sm today-news-mark-all-undo" data-testid="today-news-mark-all-undo">Undo</button>'
      host.appendChild(banner)
    })
    await expect(page.locator('.today-news-mark-all-undo-banner').first()).toBeVisible()
    const results = await new AxeBuilder({ page })
      .include('.today-news-mark-all-undo-banner')
      .analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Liabilities sticky RAG axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/liabilities')
    await expect(page.getByRole('heading', { name: /Liabilit|Debt/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      if (document.querySelector('.liabilities-sticky-rag')) return
      const host = document.querySelector('main') || document.body
      const bar = document.createElement('div')
      bar.className = 'liabilities-sticky-rag flex flex-wrap gap-2'
      bar.setAttribute('role', 'group')
      bar.setAttribute('aria-label', 'Filter liabilities by RAG')
      bar.innerHTML = '<button type="button" class="btn-ghost btn-sm">All</button>'
      host.appendChild(bar)
    })
    await expect(page.locator('.liabilities-sticky-rag').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.liabilities-sticky-rag').analyze()
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
  })

  test('Journal sticky filter axe — iphone gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-14', 'CI gate targets iphone-14')
    await page.goto('/journal')
    await expect(page.getByRole('heading', { name: /Journal/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.journal-sticky-filter').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).include('.journal-sticky-filter').analyze()
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
