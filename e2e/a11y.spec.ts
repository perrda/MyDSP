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
        localStorage.setItem(
          'fcc_security',
          JSON.stringify({
            pinEnabled: false,
            pinHash: '',
            autoLockMinutes: 5,
            biometricEnabled: false,
          }),
        )
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

  test('compare page has no serious axe violations', async ({ page }) => {
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
