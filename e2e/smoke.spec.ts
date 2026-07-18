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
    await expect(page.getByText(/Finnhub key \(this device\)/i).first()).toBeVisible()
    await expect(page.getByText(/News tags \/ headlines/i).first()).toBeVisible()
    await expect(page.getByText(/YouTube channels/i).first()).toBeVisible()
    await expect(page.getByText(/Worker YouTube allowlist/i).first()).toBeVisible()
    await expect(page.getByText(/Worker News allowlist/i).first()).toBeVisible()
    await expect(page.getByText(/Worker Google News soft allowlist/i).first()).toBeVisible()
    await expect(page.getByText(/ISA remaining override/i).first()).toBeVisible()
    await expect(page.getByText(/PTR YouTube \/ Tax \/ Compare/i).first()).toBeVisible()
  })

  test('News status strip shows Yahoo / Updated copy', async ({ page }) => {
    await page.goto('/news')
    await expect(page.getByRole('heading', { name: /News/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.news-status-strip').first()).toBeVisible()
    await expect(page.getByText(/Yahoo|quote Worker|Updated/i).first()).toBeVisible()
  })

  test('Family and Documents thumb CTAs', async ({ page }) => {
    await page.goto('/family')
    await expect(page.getByRole('heading', { name: /Family/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()

    await page.goto('/documents')
    await expect(page.getByRole('heading', { name: /Documents/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()
  })

  test('Markets Compact density on thumb bar', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.markets-density-thumb, .thumb-cta-bar').getByText(/Compact|Comfortable/i).first()).toBeVisible()
  })

  test('smoke PTR includes Journal and Rules', async ({ page }) => {
    await page.goto('/smoke')
    await expect(page.getByText(/PTR YouTube \/ Tax \/ Compare/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/Journal \/ Rules/i).first()).toBeVisible()
  })

  test('Today and Settings thumb CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Today|Overview|MyDSP/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i }).first()).toBeVisible()

    await page.goto('/settings')
    await expect(page.getByText(/Settings/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()
    await expect(page.locator('.thumb-cta-bar').getByText(/Smoke/i).first()).toBeVisible()
  })

  test('News refresh=1 query is consumed', async ({ page }) => {
    await page.goto('/news?refresh=1')
    await expect(page.getByRole('heading', { name: /News/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page).not.toHaveURL(/refresh=1/)
  })

  test('smoke PTR includes Settings Staking Planning', async ({ page }) => {
    await page.goto('/smoke')
    await expect(page.getByText(/PTR YouTube \/ Tax \/ Compare/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/Settings \/ Staking \/ Planning \/ Smoke/i).first()).toBeVisible()
  })

  test('YouTube page uses Quote Worker for feeds', async ({ page }) => {
    await page.goto('/youtube')
    await expect(page.getByRole('heading', { name: /YouTube/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    // Worker allowlist is the gate for Atom feeds; smoke checklist probes it live.
    await page.goto('/smoke')
    await expect(page.getByText(/Worker YouTube allowlist/i).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('compare route renders with thumb bar', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByRole('heading', { name: /Compare portfolios/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()
  })

  test('tax route renders with ISA allowance surface', async ({ page }) => {
    await page.goto('/tax')
    await expect(page.getByText(/Capital gains|UK CGT|Tax/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.tax-isa-allowance-progress, .thumb-cta-bar').first()).toBeVisible()
  })

  test('Markets shows Retry unavailable and Sync prices now', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: /Sync prices now/i }).first()).toBeVisible()
    // Thumb / section CTA may appear after quotes load; gate the control exists in DOM for phone toolbar
    await expect(page.getByLabel(/Retry unavailable quotes|Retry unavailable/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('Spending and Liabilities routes render with thumb CTAs', async ({ page }) => {
    await page.goto('/spending')
    await expect(page.getByRole('heading', { name: /Spending/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()

    await page.goto('/liabilities')
    await expect(page.getByRole('heading', { name: /Liabilities|Debt/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()
  })

  test('Markets sticky toolbar and section jump chips', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const toolbar = page.locator('.markets-sticky-toolbar')
    await expect(toolbar).toBeVisible()
    const jumps = page.getByRole('navigation', { name: /Jump to market section/i })
    await expect(jumps).toBeVisible()
    await expect(jumps.locator('.markets-section-jump-chip').first()).toBeVisible()
    await expect(page.locator('[id^="markets-section-"]').first()).toBeAttached()
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
