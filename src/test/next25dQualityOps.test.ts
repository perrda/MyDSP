import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  releaseBulletHref,
  releaseBulletText,
  releaseNotesArchive,
  RELEASE_NOTES,
} from '../domain/releaseNotes'
import { detectBrokerPreset } from '../services/tradeCsvImport'

describe('next25d quality / ops (21–25)', () => {
  it('21: Settings pins Sync / Security / Backup chips', () => {
    const src = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(src).toMatch(/settings-pin-chip/)
    expect(src).toMatch(/\['sync', 'Sync'\]/)
    expect(src).toMatch(/\['security', 'Security'\]/)
    expect(src).toMatch(/\['full-backup', 'Backup'\]/)
  })

  it('22: /smoke checks PIN/Face ID and bottom-nav slots', () => {
    const src = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(src).toMatch(/id: 'lock'/)
    expect(src).toMatch(/id: 'bottom-nav'/)
    expect(src).toMatch(/loadSecurity/)
    expect(src).toMatch(/loadBottomNavMiddleSlots/)
  })

  it('23: Playwright smoke covers Markets search + smoke lock/nav', () => {
    const src = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(src).toMatch(/Search watchlist/)
    expect(src).toMatch(/Bottom nav middle slots/)
    expect(src).toContain('Face ID lock')
    expect(src).toMatch(/Today → Markets → Settings/)
  })

  it('24: broker alias pack detects IBKR Flex / T212 fill / Coinbase advanced', () => {
    expect(detectBrokerPreset(['Trade Date', 'Buy/Sell', 'Quantity', 'IBCommission']).id).toBe(
      'ibkr',
    )
    expect(detectBrokerPreset(['Action', 'Time', 'Ticker', 'Fill Price', 'No. of shares']).id).toBe(
      'trading212',
    )
    expect(
      detectBrokerPreset(['Timestamp', 'Transaction Type', 'Quantity Transacted', 'Spot Price']).id,
    ).toBe('coinbase')
    const src = readFileSync(resolve(__dirname, '../services/tradeCsvImport.ts'), 'utf8')
    expect(src).toMatch(/fillprice/)
    expect(src).toMatch(/ibcommission/)
  })

  it('25: What’s new / UpdateBanner bullets deep-link', () => {
    expect(RELEASE_NOTES[0]).toBeTruthy()
    const linked = RELEASE_NOTES[0]!.bullets.filter((b) => releaseBulletHref(b))
    expect(linked.length).toBeGreaterThan(0)
    expect(releaseBulletText(linked[0]!).length).toBeGreaterThan(0)
    expect(releaseNotesArchive(5)).toHaveLength(5)

    const banner = readFileSync(resolve(__dirname, '../components/UpdateBanner.tsx'), 'utf8')
    expect(banner).toMatch(/releaseBulletHref/)
    expect(banner).toMatch(/<Link to=\{href\}/)

    const archive = readFileSync(resolve(__dirname, '../components/WhatsNewArchive.tsx'), 'utf8')
    expect(archive).toMatch(/releaseBulletHref/)
    expect(archive).toMatch(/<Link to=\{href\}/)
  })
})
