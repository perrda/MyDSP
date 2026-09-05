import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('MyDSP 1.2.165 UI polish — nav clearance, 44px taps, CHARTS wrap', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.165')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.165')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.165',
      '1.2.164',
      '1.2.163',
      '1.2.162',
      '1.2.161',
    ])
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1.2.165/)
    const section = read('../../CHANGELOG.md').match(/## \[1\.2\.165\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/4\.25rem/)
    expect(section).toMatch(/44/)
    expect(section).toMatch(/CHARTS/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/nav clearance \+ 44px taps \+ CHARTS wrap \(v1\.2\.165\)/)
  })

  it('1: short landscape content clears the fixed bottom nav', () => {
    const css = read('../index.css')
    expect(css).toMatch(
      /orientation: landscape\) and \(max-height: 500px\)[\s\S]*html\.has-bottom-nav \.app-main\s*\{[\s\S]*padding-bottom:\s*calc\(4\.25rem \+ 0\.5rem \+ env\(safe-area-inset-bottom/s,
    )
    expect(css).toMatch(
      /orientation: landscape\) and \(max-height: 500px\)[\s\S]*html\.has-bottom-nav \.app-content\.app-content-with-bottom-nav\s*\{[\s\S]*overflow-y:\s*auto/s,
    )
    expect(css).toMatch(
      /\.app-content\.app-content-with-bottom-nav\s*\{[\s\S]*scroll-padding-bottom:\s*calc\(5\.5rem/s,
    )
    expect(css).toMatch(
      /orientation: landscape\) and \(max-height: 500px\)[\s\S]*\.bottom-nav--tablet \.bottom-nav-media-link \.bottom-nav-link-label/s,
    )
  })

  it('2: header menu / refresh / more tap targets are ≥44px', () => {
    const css = read('../index.css')
    expect(css).toMatch(
      /\.toolbar-icon\s*\{[\s\S]*width:\s*2\.75rem;[\s\S]*height:\s*2\.75rem;[\s\S]*min-width:\s*2\.75rem;[\s\S]*min-height:\s*2\.75rem;/s,
    )
    expect(css).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.toolbar-icon\s*\{[\s\S]*?width:\s*2\.75rem;[\s\S]*?min-height:\s*2\.75rem;/s,
    )
    expect(css).toMatch(/\.toolbar-refresh\s*\{[\s\S]*color:\s*#f7931a/i)
  })

  it('3: Today CHARTS jump wraps at 390 instead of clipping', () => {
    const css = read('../index.css')
    expect(css).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.today-section-jump-chips\s*\{[\s\S]*?flex-wrap:\s*wrap[\s\S]*?overflow-x:\s*visible/s,
    )
    const dash = read('../pages/Dashboard.tsx')
    expect(dash).toMatch(/today-section-jump-charts/)
    expect(dash).toMatch(/\['today-charts', 'Charts'/)
  })
})
