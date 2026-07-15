import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('mobile / iPad clarity batch', () => {
  it('hides idle Last Sync meta on phone and unifies home as Today', () => {
    const src = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(src).toMatch(/Last Sync/)
    expect(src).toMatch(/hidden md:block/)
    expect(src).toMatch(/title:\s*'Today'/)
  })

  it('labels Markets change badges as 24h', () => {
    const src = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(src).toMatch(/windowLabel\s*=\s*'24h'/)
  })

  it('rooms tablet bottom-nav hit targets', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.bottom-nav--tablet/)
  })

  it('puts holdings lists before charts below lg', () => {
    for (const file of ['EquitiesPage.tsx', 'CryptoPage.tsx']) {
      const src = readFileSync(resolve(__dirname, `../pages/${file}`), 'utf8')
      expect(src).toMatch(/order-1 lg:order-2/)
      expect(src).toMatch(/order-2 lg:order-1/)
    }
  })

  it('exposes PWA shortcuts for Today, Markets, and Settings', () => {
    const manifest = readFileSync(resolve(__dirname, '../../public/manifest.webmanifest'), 'utf8')
    const json = JSON.parse(manifest) as { shortcuts?: { name: string; url: string }[] }
    const names = (json.shortcuts ?? []).map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(['Today', 'Markets', 'Settings']))
  })

  it('keeps LoadingSpinner compact (not full-screen takeover)', () => {
    const src = readFileSync(resolve(__dirname, '../components/LoadingSpinner.tsx'), 'utf8')
    expect(src).not.toMatch(/min-h-screen/)
    expect(src).toMatch(/min-h-\[40vh\]/)
  })
})
