import { expect, test } from '@playwright/test'

test.describe('MyDSP smoke', () => {
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

  test('loads overview', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/MyDSP/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/overview/i).first()).toBeVisible()
  })

  test('currency select works', async ({ page }) => {
    await page.goto('/')
    const currency = page.getByLabel('Display currency')
    await expect(currency).toBeVisible({ timeout: 20_000 })
    await currency.selectOption('USD')
    await expect(currency).toHaveValue('USD')
  })

  test('goals route renders', async ({ page }) => {
    await page.goto('/goals')
    await expect(page.getByText(/financial goals/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
