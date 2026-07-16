import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('next25f quality / ops items 21-25', () => {
  it('21: axe CI covers Crypto, Spending, and Holding detail', () => {
    const a11y = readFileSync(resolve(__dirname, '../../e2e/a11y.spec.ts'), 'utf8')

    expect(a11y).toMatch(/Crypto axe/)
    expect(a11y).toMatch(/Spending axe/)
    expect(a11y).toMatch(/Holding detail axe/)
    expect(a11y).toMatch(/\/crypto/)
    expect(a11y).toMatch(/\/spending/)
    expect(a11y).toMatch(/\/crypto\/1/)
  })

  it('22: Playwright smoke mentions digest Preview/Share, not only download', () => {
    const smoke = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')

    expect(smoke).toMatch(/weekly digest Preview\/Share modal/)
    expect(smoke).toMatch(/Digest Preview/)
    expect(smoke).toMatch(/Highlights to include/)
    expect(smoke).toMatch(/Share\|Copy HTML/)
  })

  it('23: /smoke checklist includes Weekly digest Share', () => {
    const smokePage = readFileSync(resolve(__dirname, '../pages/SmokePage.tsx'), 'utf8')
    const smokeSpec = readFileSync(resolve(__dirname, '../../e2e/smoke.spec.ts'), 'utf8')

    expect(smokePage).toMatch(/weekly-digest/)
    expect(smokePage).toMatch(/Weekly digest Share/)
    expect(smokePage).toMatch(/WeeklyDigestModal/)
    expect(smokeSpec).toMatch(/Weekly digest Share/)
  })

  it('24: windowed holdings announce Showing N of M with aria-live', () => {
    const equities = readFileSync(resolve(__dirname, '../pages/EquitiesPage.tsx'), 'utf8')
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')

    for (const src of [equities, crypto]) {
      expect(src).toMatch(/holdings-window-sentinel/)
      expect(src).toMatch(/aria-live="polite"/)
      expect(src).toMatch(/Showing \{listHoldings\.length\} of \{filteredHoldings\.length\}/)
    }
  })

  it('25: UI conventions documents WeeklyDigestModal Share/Preview', () => {
    const docs = readFileSync(resolve(__dirname, '../../docs/UI_CONVENTIONS.md'), 'utf8')

    expect(docs).toMatch(/Weekly digest Preview\/Share/)
    expect(docs).toMatch(/WeeklyDigestModal/)
    expect(docs).toMatch(/native Share\/copy\/download fallback/)
    expect(docs).toMatch(/pass `WeeklyDigestInput\.privacy`/)
  })
})
