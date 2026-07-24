import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { normalizePortfolio } from '../domain/normalize'

describe('Liability commentary collapse + preferred contact (v1.2.100)', () => {
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

  it('normalizes preferred contact method + other details', () => {
    const data = normalizePortfolio({
      loans: [
        {
          id: 1,
          name: 'Monzo',
          balance: 1000,
          apr: 10,
          minPay: 50,
          original: 2000,
          preferredContactMethod: 'other',
          preferredContactOther: ' In-app chat ',
        },
      ],
      creditCards: [
        {
          id: 2,
          name: 'Card',
          balance: 100,
          apr: 20,
          minPay: 10,
          limit: 500,
          preferredContactMethod: 'email',
          preferredContactOther: 'should-drop',
        },
      ],
    })
    expect(data.loans[0]?.preferredContactMethod).toBe('other')
    expect(data.loans[0]?.preferredContactOther).toBe('In-app chat')
    expect(data.creditCards[0]?.preferredContactMethod).toBe('email')
    expect(data.creditCards[0]?.preferredContactOther).toBeUndefined()
  })

  it('detail commentary: newest stays open; older are collapsible', () => {
    const page = readFileSync(resolve(__dirname, '../pages/LiabilityDetailPage.tsx'), 'utf8')
    expect(page).toMatch(/data-testid="liability-commentary-list"/)
    expect(page).toMatch(/liability-commentary-latest/)
    expect(page).toMatch(/liability-commentary-older/)
    expect(page).toMatch(/expandedOlderIds/)
    expect(page).toMatch(/toggleOlderCommentary/)
    expect(page).toMatch(/isLatest/)
    expect(page).toMatch(/>Latest</)
  })

  it('preferred method of contact on detail + list forms', () => {
    const detail = readFileSync(resolve(__dirname, '../pages/LiabilityDetailPage.tsx'), 'utf8')
    expect(detail).toMatch(/Preferred method of contact/)
    expect(detail).toMatch(/data-testid="liability-contact-preferred"/)
    expect(detail).toMatch(/data-testid="liability-contact-preferred-other"/)
    expect(detail).toMatch(/preferredContactMethod/)
    const list = readFileSync(resolve(__dirname, '../pages/LiabilitiesPage.tsx'), 'utf8')
    expect(list).toMatch(/data-testid="liability-form-contact-preferred"/)
    expect(list).toMatch(/preferredContactMethod/)
  })
})
