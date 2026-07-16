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
    await expect(page.getByText(/overview|today/i).first()).toBeVisible()
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

  test('Today → Markets → Settings navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Today|Overview|MyDSP/i).first()).toBeVisible({ timeout: 20_000 })

    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const search = page.getByLabel(/Search watchlist/i).or(page.getByPlaceholder(/Search watchlist/i))
    if (await search.first().isVisible().catch(() => false)) {
      await search.first().fill('BTC')
    }

    await page.goto('/settings')
    await expect(page.getByText(/Settings/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Encrypted cloud sync|Cloud Sync|Sync/i).first()).toBeVisible()
  })

  test('smoke checklist includes lock and bottom-nav checks', async ({ page }) => {
    await page.goto('/smoke')
    await expect(page.getByText(/On-device smoke|smoke/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/PIN \/ Face ID lock/i).first()).toBeVisible()
    await expect(page.getByText(/Bottom nav middle slots/i).first()).toBeVisible()
  })
})
