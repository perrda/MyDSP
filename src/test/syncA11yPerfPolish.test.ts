import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Sync / a11y / perf polish batch (41–50)', () => {
  it('41: Markets and holdings show skeleton shimmer while loading', () => {
    const markets = readFileSync(resolve(__dirname, '../pages/MarketsPage.tsx'), 'utf8')
    expect(markets).toMatch(/MarketsHoldingsSkeleton/)
    expect(markets).toMatch(/initialLoad/)
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    expect(equities).toMatch(/MarketsHoldingsSkeleton/)
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    expect(crypto).toMatch(/MarketsHoldingsSkeleton/)
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/@keyframes shimmer/)
    expect(css).toMatch(/\.skeleton/)
  })

  it('42: BottomNav prefetches Markets quotes on focus/hover', () => {
    const src = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(src).toMatch(/prefetchMarketQuotes/)
    expect(src).toMatch(/onMouseEnter/)
    expect(src).toMatch(/onFocus/)
    expect(src).toMatch(/\/markets/)
    const quotes = readFileSync(resolve(__dirname, '../services/marketsQuotes.ts'), 'utf8')
    expect(quotes).toMatch(/export function prefetchMarketQuotes/)
  })

  it('43: prefers-reduced-motion disables sparkline draw-on and modal sheet motion', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/)
    expect(css).toMatch(/sparkline-draw-on/)
    expect(css).toMatch(/\.modal-enter/)
    const spark = readFileSync(resolve(__dirname, '../components/charts/Sparkline.tsx'), 'utf8')
    expect(spark).toMatch(/usePrefersReducedMotion/)
    expect(spark).toMatch(/sparkline-draw-on/)
    expect(spark).toMatch(/isAnimationActive=\{!reduceMotion\}/)
  })

  it('44: bumps muted/subtle text tokens for contrast in light and dark', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/\.dark[\s\S]*--text-muted:\s*#f9fafb/)
    expect(css).toMatch(/\.dark[\s\S]*--text-subtle:\s*#e5e7eb/)
    expect(css).toMatch(/\.light[\s\S]*--text-muted:\s*#111827/)
    expect(css).toMatch(/\.light[\s\S]*--text-subtle:\s*#374151/)
  })

  it('45: shell landmarks expose header/nav/main labels', () => {
    const shell = readFileSync(resolve(__dirname, '../components/layout/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/role=\"banner\"/)
    expect(shell).toMatch(/aria-label=\"App header\"/)
    expect(shell).toMatch(/role=\"main\"/)
    expect(shell).toMatch(/aria-label=\"Main content\"/)
    const nav = readFileSync(resolve(__dirname, '../components/layout/BottomNav.tsx'), 'utf8')
    expect(nav).toMatch(/role=\"navigation\"/)
    expect(nav).toMatch(/aria-label=/)
    const side = readFileSync(resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf8')
    expect(side).toMatch(/aria-label=\"Sidebar navigation\"/)
    expect(side).toMatch(/aria-label=\"Primary\"/)
  })

  it('46: Glass Mode frosted controls keep visible focus rings', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/html\.glass :focus-visible/)
    expect(css).toMatch(/html\.glass \.toolbar-icon:focus-visible/)
    expect(css).toMatch(/html\.glass \.toolbar-select:focus-visible/)
  })

  it('47: Dashboard lazy-loads heavy recharts via LazyCharts wrapper', () => {
    const dash = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(dash).toMatch(/LazyCharts/)
    const lazy = readFileSync(resolve(__dirname, '../components/charts/LazyCharts.tsx'), 'utf8')
    expect(lazy).toMatch(/lazy\(/)
    expect(lazy).toMatch(/Suspense/)
    expect(lazy).toMatch(/AllocationRing/)
    expect(lazy).toMatch(/PortfolioSeriesChart|NetWorthChart/)
  })

  it('48: Settings Sync shows Quote Worker health badge', () => {
    const src = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(src).toMatch(/formatMarketsProviderHealthHint/)
    expect(src).toMatch(/quote-worker-health/)
    expect(src).toMatch(/Quote Worker/)
  })

  it('49: Today/Dashboard soft weekly backup nudge uses LAST_BACKUP_KEY', () => {
    const src = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(src).toMatch(/LAST_BACKUP_KEY/)
    expect(src).toMatch(/backup-nudge/)
    expect(src).toMatch(/settings#full-backup/)
    expect(src).toMatch(/7 \* 24 \* 60 \* 60 \* 1000/)
  })

  it('50: Playwright covers iPhone 14 and iPad Air smoke paths', () => {
    const cfg = readFileSync(resolve(__dirname, '../../playwright.config.ts'), 'utf8')
    expect(cfg).toMatch(/iPhone 14/)
    expect(cfg).toMatch(/iPad Air/)
    const smoke = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')
    expect(smoke).toMatch(/Today → Markets → Settings/)
    expect(smoke).toMatch(/\/markets/)
    expect(smoke).toMatch(/\/settings/)
  })
})
