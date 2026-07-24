import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { normalizePortfolio } from '../domain/normalize'

describe('Liability lender contacts CRUD (v1.2.99)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.100')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.100')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.100',
      '1.2.99',
      '1.2.98',
      '1.2.97',
      '1.2.96',
    ])
  })

  it('normalizes phone / email / URL on cards and loans', () => {
    const data = normalizePortfolio({
      creditCards: [
        {
          id: 1,
          name: 'Barclaycard',
          balance: 1000,
          apr: 22,
          minPay: 50,
          limit: 5000,
          contactPhone: ' 0800 123 ',
          contactEmail: ' help@barclaycard.co.uk ',
          contactUrl: ' https://barclaycard.co.uk ',
        },
      ],
      loans: [
        {
          id: 2,
          name: 'Moorcroft',
          balance: 25000,
          apr: 12,
          minPay: 255,
          original: 30000,
          contactPhone: '0345 111',
          contactEmail: 'debt@moorcroft.co.uk',
          contactUrl: 'moorcroft.co.uk',
        },
      ],
    })
    expect(data.creditCards[0]?.contactPhone).toBe('0800 123')
    expect(data.creditCards[0]?.contactEmail).toBe('help@barclaycard.co.uk')
    expect(data.creditCards[0]?.contactUrl).toBe('https://barclaycard.co.uk')
    expect(data.loans[0]?.contactPhone).toBe('0345 111')
    expect(data.loans[0]?.contactEmail).toBe('debt@moorcroft.co.uk')
    expect(data.loans[0]?.contactUrl).toBe('moorcroft.co.uk')
  })

  it('detail page has inline Edit/Add + Save contacts form', () => {
    const page = readFileSync(resolve(__dirname, '../pages/LiabilityDetailPage.tsx'), 'utf8')
    expect(page).toMatch(/data-testid="liability-contacts"/)
    expect(page).toMatch(/data-testid="liability-contacts-edit"/)
    expect(page).toMatch(/data-testid="liability-contacts-form"/)
    expect(page).toMatch(/data-testid="liability-contact-phone"/)
    expect(page).toMatch(/data-testid="liability-contact-email"/)
    expect(page).toMatch(/data-testid="liability-contact-url"/)
    expect(page).toMatch(/data-testid="liability-contacts-save"/)
    expect(page).toMatch(/data-testid="liability-contacts-clear"/)
    expect(page).toMatch(/Save contacts/)
    expect(page).toMatch(/Clear contacts/)
    expect(page).toMatch(/beginInlineContactEdit/)
    expect(page).toMatch(/saveContact/)
  })

  it('list create/edit modal includes lender contact fields', () => {
    const page = readFileSync(resolve(__dirname, '../pages/LiabilitiesPage.tsx'), 'utf8')
    expect(page).toMatch(/Lender contacts/)
    expect(page).toMatch(/data-testid="liability-form-contact-phone"/)
    expect(page).toMatch(/data-testid="liability-form-contact-email"/)
    expect(page).toMatch(/data-testid="liability-form-contact-url"/)
    expect(page).toMatch(/form\.contactPhone\.trim\(\)/)
    expect(page).toMatch(/form\.contactEmail\.trim\(\)/)
    expect(page).toMatch(/form\.contactUrl\.trim\(\)/)
  })
})
