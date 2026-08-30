import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'

const page = (name: string) => readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('Mobile content-first chrome (v1.2.108)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.145')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.145')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.145',
      '1.2.144',
      '1.2.143',
      '1.2.141',
      '1.2.140',
    ])
  })

  it('cursor rule + CSS hide fixed bottom create bars', () => {
    const rule = readFileSync(
      resolve(__dirname, '../../.cursor/rules/mobile-content-first-chrome.mdc'),
      'utf8',
    )
    expect(rule).toMatch(/alwaysApply:\s*true/)
    expect(rule).toMatch(/PagePrimaryActions|PageHeader/)
    expect(rule).toMatch(/thumb-cta-bar/)

    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
    expect(css).toMatch(/mobile-content-first-chrome/)
    expect(css).toMatch(/\.thumb-cta-bar,\s*\n\.thumb-cta-bar-spacer/)
    expect(css).toMatch(/display:\s*none\s*!important/)
  })

  it('To Do’s / Jobs / Markets / Money ops use header create chrome', () => {
    for (const file of [
      'TodosPage.tsx',
      'JobsPage.tsx',
      'MarketsPage.tsx',
      'SpendingPage.tsx',
      'BudgetsPage.tsx',
      'RecurringPage.tsx',
      'TaxPage.tsx',
      'LiabilitiesPage.tsx',
    ]) {
      const src = page(file)
      expect(src).toMatch(/page-primary-actions|page-primary-create|PagePrimaryActions/)
      expect(src).not.toMatch(/className="thumb-cta-bar"/)
    }
    expect(page('OptimizerPage.tsx')).toMatch(/page-primary-actions/)
    expect(page('OptimizerPage.tsx')).not.toMatch(/className="thumb-cta-bar"/)
  })

  it('PagePrimaryActions component exists', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/ui/PagePrimaryActions.tsx'),
      'utf8',
    )
    expect(src).toMatch(/OverflowMenu/)
    expect(src).toMatch(/data-testid="page-primary-create"/)
  })
})
