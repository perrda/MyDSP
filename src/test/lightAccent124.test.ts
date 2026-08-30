import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { DEFAULT_CHART_COLORS } from '../utils/chartPalette'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

const BTC_ORANGE = '#F7931A'
const MUTED_BROWNS = ['#9a5500', '#7a4200', '#91591D', '#A26A2F', '#91591d', '#a26a2f']

describe('MyDSP 1.2.124 light-mode accent recut', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.136')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.136')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.136',
      '1.2.134',
      '1.2.133',
      '1.2.132',
      '1.2.131',
    ])
    const accentTip = RELEASE_NOTES.find((e) => e.version === '1.2.124')
    expect(accentTip?.bullets.map((b) => (typeof b === 'string' ? b : b.text)).join(' ')).toMatch(
      /#F7931A|muted brown|1\.2\.121/,
    )
  })

  it('Light and Dark share official BTC orange #F7931A — no muted brown fallback', () => {
    const css = read('../index.css')
    expect(css).toMatch(/David lock 29 Aug 2026/)
    expect(css).toMatch(/Light must use the SAME BTC orange/)
    expect(css).toMatch(/Do NOT revert Light to muted brown/)

    const darkBlock = css.match(/:root,\s*\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    const lightBlock = css.match(/\.light\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(darkBlock).toMatch(/--accent:\s*#F7931A/)
    expect(darkBlock).toMatch(/--accent-bright:\s*#F7931A/)
    expect(darkBlock).toMatch(/--accent-dim:\s*#F7931A/)
    expect(lightBlock).toMatch(/--accent:\s*#F7931A/)
    expect(lightBlock).toMatch(/--accent-bright:\s*#F7931A/)
    expect(lightBlock).toMatch(/--accent-dim:\s*#F7931A/)

    for (const brown of MUTED_BROWNS) {
      expect(css).not.toMatch(new RegExp(`--accent(?:-bright|-dim)?:\\s*${brown}`, 'i'))
    }
    expect(css).toContain(BTC_ORANGE)
  })

  it('chart brand slice uses the accent token; mint secondary stays', () => {
    expect(DEFAULT_CHART_COLORS[0]).toBe('var(--accent)')
    expect(DEFAULT_CHART_COLORS[1]).toBe('#86efac')
    const palette = read('../utils/chartPalette.ts')
    expect(palette).not.toMatch(/#9a5500|#7a4200|#91591D|#A26A2F/i)
  })

  it('fonts stay Inter + Space Grotesk; no SYNC_KEY; no restyle beyond accent', () => {
    const css = read('../index.css')
    expect(css).toMatch(/--font-sans:\s*"Inter"/)
    expect(css).toMatch(/--font-wordmark:\s*"Space Grotesk"/)
    expect(css).not.toMatch(/SYNC_KEY/)
    const notes = read('../domain/releaseNotes.ts')
    expect(notes).not.toMatch(/SYNC_KEY/)
    const changelog = read('../../CHANGELOG.md')
    expect(changelog).toMatch(/## \[1\.2\.124\]/)
    expect(changelog).toMatch(/Live mydspv1 stays 1\.2\.121/)
    expect(changelog).toMatch(/Do not wrangler/)
    expect(changelog).toMatch(/No `SYNC_KEY`/)
  })
})
