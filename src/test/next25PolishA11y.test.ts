import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  A11Y_CHART_CB_KEY,
  A11Y_HIGH_CONTRAST_CLASS,
  A11Y_HIGH_CONTRAST_KEY,
  A11Y_REDUCED_MOTION_CLASS,
  A11Y_REDUCED_MOTION_KEY,
  applyA11yHighContrastDom,
  applyA11yPrefsDom,
  applyA11yReducedMotionDom,
  loadA11yChartColourBlind,
  loadA11yHighContrast,
  loadA11yReducedMotion,
  saveA11yChartColourBlind,
  saveA11yHighContrast,
  saveA11yReducedMotion,
} from '../utils/a11yPrefs'
import {
  COLORBLIND_SAFE_COLORS,
  DEFAULT_CHART_COLORS,
  getChartPalette,
} from '../utils/chartPalette'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('next25 polish / a11y', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
    document.documentElement.classList.remove(
      A11Y_REDUCED_MOTION_CLASS,
      A11Y_HIGH_CONTRAST_CLASS,
    )
  })

  afterEach(() => {
    mem.clear()
    document.documentElement.classList.remove(
      A11Y_REDUCED_MOTION_CLASS,
      A11Y_HIGH_CONTRAST_CLASS,
    )
  })

  it('21: EmptyIllustration used by EmptyState on key empties', () => {
    const empty = readFileSync(resolve(__dirname, '../components/ui/EmptyState.tsx'), 'utf8')
    expect(empty).toMatch(/EmptyIllustration/)
    expect(empty).toMatch(/illustration\?:/)

    const illus = readFileSync(
      resolve(__dirname, '../components/ui/EmptyIllustration.tsx'),
      'utf8',
    )
    expect(illus).toMatch(/var\(--accent\)/)

    for (const page of ['TodosPage', 'CryptoPage', 'EquitiesPage', 'JobsPage', 'MarketsPage']) {
      const src = readFileSync(resolve(__dirname, `../pages/${page}.tsx`), 'utf8')
      expect(src).toMatch(/illustration/)
    }
  })

  it('22: Accessibility panel persists mydsp_a11y_* and applies html classes', () => {
    expect(loadA11yReducedMotion()).toBe(false)
    saveA11yReducedMotion(true)
    expect(localStorage.getItem(A11Y_REDUCED_MOTION_KEY)).toBe('1')
    applyA11yReducedMotionDom(true)
    expect(document.documentElement.classList.contains(A11Y_REDUCED_MOTION_CLASS)).toBe(true)

    saveA11yHighContrast(true)
    expect(localStorage.getItem(A11Y_HIGH_CONTRAST_KEY)).toBe('1')
    applyA11yHighContrastDom(true)
    expect(document.documentElement.classList.contains(A11Y_HIGH_CONTRAST_CLASS)).toBe(true)

    applyA11yPrefsDom()
    expect(document.documentElement.classList.contains(A11Y_REDUCED_MOTION_CLASS)).toBe(true)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/id="accessibility"/)
    expect(settings).toMatch(/mydsp_a11y_reduced_motion/)
    expect(settings).toMatch(/mydsp_a11y_high_contrast/)
    expect(settings).toMatch(/Larger text/)

    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/html\.a11y-high-contrast/)
    expect(css).toMatch(/html\.a11y-reduce-motion/)

    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
    expect(html).toMatch(/mydsp_a11y_reduced_motion/)
    expect(html).toMatch(/mydsp_a11y_high_contrast/)
  })

  it('23: colour-blind safe chart palette flag + AllocationRing', () => {
    expect(getChartPalette()).toEqual(DEFAULT_CHART_COLORS)
    saveA11yChartColourBlind(true)
    expect(localStorage.getItem(A11Y_CHART_CB_KEY)).toBe('1')
    expect(loadA11yChartColourBlind()).toBe(true)
    expect(getChartPalette()).toEqual(COLORBLIND_SAFE_COLORS)
    expect(COLORBLIND_SAFE_COLORS[0]).toMatch(/#0072B2/i)
    expect(COLORBLIND_SAFE_COLORS).toContain('#E69F00')
    expect(COLORBLIND_SAFE_COLORS).toContain('#D55E00')

    const ring = readFileSync(
      resolve(__dirname, '../components/charts/AllocationRing.tsx'),
      'utf8',
    )
    expect(ring).toMatch(/getChartPalette/)
    expect(ring).toMatch(/COLORBLIND_SAFE_COLORS/)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/mydsp_a11y_chart_cb|Colour-blind safe/)
  })

  it('24: axe CI gate + test:a11y script for Today/Markets/Settings on iphone-14', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')
    expect(a11y).toMatch(/iphone-14/)
    expect(a11y).toMatch(/\/markets/)
    expect(a11y).toMatch(/\/settings/)
    expect(a11y).toMatch(/AxeBuilder/)

    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts['test:a11y']).toMatch(/a11y\.spec/)
    expect(pkg.scripts['test:a11y']).toMatch(/iphone-14/)
  })

  it('25: /smoke checklist route wires sync/markets/backup/pwa checks', () => {
    const smoke = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    expect(smoke).toMatch(/Sync configured/)
    expect(smoke).toMatch(/Markets refreshed/)
    expect(smoke).toMatch(/Backup exists/)
    expect(smoke).toMatch(/PWA standalone|standalone/)
    expect(smoke).toMatch(/loadSyncConfig/)
    expect(smoke).toMatch(/loadMarketsState/)
    expect(smoke).toMatch(/listFullBackups|LAST_BACKUP_KEY/)

    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')
    expect(app).toMatch(/path="smoke"/)
    expect(app).toMatch(/SmokePage/)
  })

  it('package version is 1.2.44', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.80')
  })
})
