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
    await expect(page.getByRole('heading', { name: 'Goals' }).first()).toBeVisible({
      timeout: 20_000,
    })
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

  test('weekly digest Preview/Share modal opens from Today', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Digest Preview\/Share/i })).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('button', { name: /Digest Preview\/Share/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Weekly digest' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Weekly digest', level: 2 })).toBeVisible()
    await expect(page.getByText(/Preview below/i)).toBeVisible()
    await expect(page.getByLabel(/Highlights to include/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Share|Copy HTML/i }).first()).toBeVisible()
  })

  test('smoke checklist includes lock and bottom-nav checks', async ({ page }) => {
    await page.goto('/smoke')
    await expect(page.getByRole('list', { name: 'Smoke checklist' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/PIN \/ Face ID lock/i).first()).toBeVisible()
    await expect(page.getByText(/Bottom nav middle slots/i).first()).toBeVisible()
    await expect(page.getByText(/Weekly digest Share/i).first()).toBeVisible()
    await expect(page.getByText(/Commodities seeded/i).first()).toBeVisible()
    await expect(page.getByText(/Markets quote cache/i).first()).toBeVisible()
  })

  test('offline queue enqueue surfaces in Settings Sync', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        const job = {
          id: 'q_e2e_offline',
          type: 'sync_push',
          createdAt: new Date().toISOString(),
          remoteUrl: 'https://example.com/sync',
          note: 'e2e offline',
          attempts: 1,
          nextRetryAt: new Date(Date.now() + 60_000).toISOString(),
        }
        localStorage.setItem('mydsp_offline_queue', JSON.stringify([job]))
        localStorage.setItem(
          'mydsp_sync_config',
          JSON.stringify({
            enabled: true,
            remoteUrl: 'https://example.com/sync',
            rememberPassphrase: false,
          }),
        )
      } catch {
        /* ignore */
      }
    })
    await page.goto('/settings#sync')
    await expect(page.getByText(/Offline queue/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Retry now|e2e offline|sync push/i).first()).toBeVisible()
  })
})
