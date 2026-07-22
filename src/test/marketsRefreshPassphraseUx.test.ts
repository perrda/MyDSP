import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Markets refresh UX + passphrase chip (v1.2.90)', () => {
  it('Markets uses brief Refreshing data banner instead of permanent Sync prices CTA', () => {
    const page = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(page).toMatch(/markets-refreshing-banner/)
    expect(page).toMatch(/Refreshing data/)
    expect(page).toMatch(/flashRefreshingBanner/)
    expect(page).toMatch(/2000/)
    expect(page).not.toMatch(/btn-primary btn-sm inline-flex items-center gap-1\.5 markets-sync-prices/)
    expect(page).toMatch(/aria-label="Refresh market data now"/)
  })

  it('Passphrase chip is Unlock sync with amber attention tone', () => {
    const chip = readFileSync(resolve(__dirname, '../components/SyncStatusChip.tsx'), 'utf8')
    expect(chip).toMatch(/Unlock sync/)
    expect(chip).toMatch(/sync-chip--attention/)
    expect(chip).toMatch(/Cloud sync is waiting for your passphrase/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.sync-chip--attention/)
  })
})
