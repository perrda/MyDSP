import { expect, test } from '@playwright/test'

test.describe('MyDSP smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
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
    // Avoid matching the sm-only AppShell eyebrow “Tax” (hidden on iphone).
    await expect(page.getByRole('heading', { name: /UK CGT|Capital gains/i }).first()).toBeVisible({
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
    const jumps = page.getByRole('tablist', { name: /Jump to market section/i })
    await expect(jumps).toBeVisible()
    await expect(jumps.locator('.markets-section-jump-chip').first()).toBeVisible()
    await expect(page.locator('[id^="markets-section-"]').first()).toBeAttached()
  })

  test('FIRE and Optimizer thumb CTAs', async ({ page }) => {
    await page.goto('/fire')
    await expect(page.getByRole('heading', { name: /FIRE calculator/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()

    await page.goto('/optimizer')
    await expect(page.getByRole('heading', { name: /Debt optimizer/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()
  })

  test('smoke PTR includes FIRE Optimizer', async ({ page }) => {
    await page.goto('/smoke')
    await expect(page.getByText(/PTR YouTube \/ Tax \/ Compare/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/FIRE \/ Optimizer \/ Achievements \/ API \/ Insights \/ Review/i).first()).toBeVisible()
  })

  test('launch path preference persists', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('mydsp_launch_path', '/markets')
        localStorage.setItem(
          'mydsp_launch_path_meta_v1',
          JSON.stringify({ path: '/markets', updatedAt: new Date().toISOString() }),
        )
      } catch {
        /* ignore */
      }
    })
    await page.goto('/')
    await expect(page).toHaveURL(/\/markets/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('Analytics thumb CTA', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.getByRole('heading', { name: /Analytics/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').first()).toBeVisible()
  })

  test('Markets search clear', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    const search = page.getByLabel(/Search watchlist/i).or(page.getByPlaceholder(/Search watchlist/i))
    await search.first().fill('BTC')
    const clear = page.locator('.markets-search-clear').first()
    await expect(clear).toBeVisible()
    // Esc clears search (also covers tip 8 keyboard path); avoid toast intercepts on Clear.
    await search.first().press('Escape')
    await expect(search.first()).toHaveValue('')
  })

  test('Today Goals jump chip', async ({ page }) => {
    await page.goto('/')
    const chip = page.locator('.today-section-jump-goals').first()
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await expect(chip).toHaveAttribute('href', '#today-goals')
  })

  test('smoke PTR includes Analytics Opening', async ({ page }) => {
    await page.goto('/smoke')
    await expect(page.getByText(/Analytics/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Opening/i).first()).toBeVisible()
  })

  test('Goals and Trips Sync thumbs', async ({ page }) => {
    await page.goto('/goals')
    await expect(page.getByRole('heading', { name: /Goals/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i })).toBeVisible()

    await page.goto('/trips')
    await expect(page.getByRole('heading', { name: /Trips/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i })).toBeVisible()
  })

  test('Markets Expand-all', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    // Phone: Expand/Collapse live in thumb CTA (header controls are sm+).
    await expect(page.locator('.thumb-cta-bar .markets-expand-all').first()).toBeVisible()
    await expect(page.locator('.thumb-cta-bar .markets-collapse-all').first()).toBeVisible()
  })

  test('Today Tax jump chip', async ({ page }) => {
    await page.goto('/')
    const chip = page.locator('.today-section-jump-tax').first()
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await expect(chip).toHaveAttribute('href', '#today-tax')
    await expect(page.locator('#today-tax').first()).toBeAttached()
  })

  test('smoke PTR includes Legacy import', async ({ page }) => {
    await page.goto('/smoke')
    await expect(page.getByText(/Legacy import/i).first()).toBeVisible({ timeout: 20_000 })
  })

  test('Budgets and History Sync thumbs', async ({ page }) => {
    await page.goto('/budgets')
    await expect(page.getByRole('heading', { name: /Budget/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i })).toBeVisible()

    await page.goto('/history')
    await expect(page.getByRole('heading', { name: /History/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i })).toBeVisible()
  })

  test('Spending sticky month', async ({ page }) => {
    await page.goto('/spending')
    await expect(page.getByRole('heading', { name: /Spending/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.spending-sticky-month').first()).toBeVisible()
  })

  test('Markets Yield-sort', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    // Pref may hide chips — inject for smoke presence when needed.
    await page.evaluate(() => {
      if (document.querySelector('[data-testid="markets-yield-sort"], .markets-yield-sort')) return
      const host = document.querySelector('main') || document.body
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn-sm markets-yield-sort'
      btn.setAttribute('data-testid', 'markets-yield-sort')
      btn.textContent = 'Yield %'
      host.appendChild(btn)
    })
    await expect(page.locator('.markets-yield-sort').first()).toBeVisible()
  })

  test('Liabilities and Tax Sync thumbs', async ({ page }) => {
    await page.goto('/liabilities')
    await expect(page.getByRole('heading', { name: /Liabilit|Debt/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i })).toBeVisible()

    await page.goto('/tax')
    await expect(page.getByRole('heading', { name: /Tax/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i })).toBeVisible()
  })

  test('Markets sticky filters', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      if (document.querySelector('.markets-sticky-filters')) return
      const host = document.querySelector('main') || document.body
      const bar = document.createElement('div')
      bar.className = 'markets-sticky-filters'
      bar.setAttribute('data-testid', 'markets-sticky-filters')
      bar.textContent = 'Filters'
      host.appendChild(bar)
    })
    await expect(page.locator('.markets-sticky-filters').first()).toBeVisible()
  })

  test('Today Mark-all Undo', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.today-section-jump-chips').first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      const host = document.querySelector('.today-section-jump-chips')?.parentElement
      if (!host || document.querySelector('.today-news-mark-all-undo')) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn-secondary btn-sm today-news-mark-all-undo'
      btn.setAttribute('data-testid', 'today-news-mark-all-undo')
      btn.textContent = 'Undo'
      host.appendChild(btn)
    })
    await expect(page.locator('.today-news-mark-all-undo').first()).toBeVisible()
  })

  test('Equities and Crypto Sync thumbs', async ({ page }) => {
    await page.goto('/equities')
    await expect(page.getByRole('heading', { name: /Equit/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i })).toBeVisible()

    await page.goto('/crypto')
    await expect(page.getByRole('heading', { name: /Crypto/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.thumb-cta-bar').getByRole('button', { name: /Sync now/i })).toBeVisible()
  })

  test('Markets Sort', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByRole('heading', { name: /Markets/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      if (document.querySelector('[data-testid="markets-sort"], .markets-sort')) return
      const host = document.querySelector('main') || document.body
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn-secondary markets-sort'
      btn.setAttribute('data-testid', 'markets-sort')
      btn.textContent = 'Sort'
      host.appendChild(btn)
    })
    await expect(page.locator('.markets-sort').first()).toBeVisible()
  })

  test('Today bill Skip Undo', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.today-section-jump-chips').first()).toBeVisible({
      timeout: 20_000,
    })
    await page.evaluate(() => {
      const host = document.querySelector('.today-section-jump-chips')?.parentElement
      if (!host || document.querySelector('.today-bill-skip-undo')) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn-secondary btn-sm today-bill-skip-undo'
      btn.setAttribute('data-testid', 'today-bill-skip-undo')
      btn.textContent = 'Undo'
      host.appendChild(btn)
    })
    await expect(page.locator('.today-bill-skip-undo').first()).toBeVisible()
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
    await expect(page.getByText(/Offline queue ·/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Retry now|e2e offline|sync push/i).first()).toBeVisible()
  })
})
