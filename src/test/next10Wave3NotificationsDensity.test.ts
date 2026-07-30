import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readPage = (name: string) =>
  readFileSync(resolve(__dirname, `../pages/${name}`), 'utf8')

describe('next-10 wave 3 Notification Center and resize density', () => {
  it('keeps lower-traffic pages content-first with compact row actions', () => {
    for (const name of [
      'Goals.tsx',
      'TripsPage.tsx',
      'FamilyPage.tsx',
      'JournalPage.tsx',
      'DocumentsPage.tsx',
    ]) {
      const page = readPage(name)
      expect(page).toMatch(/PagePrimaryActions/)
      expect(page).toMatch(/<OverflowMenu[\s\S]*?compact/)
      expect(page).not.toMatch(/className="thumb-cta-bar"|thumb-cta-bar-spacer/)
      expect(page).not.toMatch(/\bp-(?:6|8)\b/)
    }
  })

  it('retains leading actions where a row has a useful primary action', () => {
    expect(readPage('Goals.tsx')).toMatch(/leading=\{[\s\S]*?Commentary/)
    expect(readPage('TripsPage.tsx')).toMatch(/leading=\{[\s\S]*?View spend/)
    expect(readPage('DocumentsPage.tsx')).toMatch(/leading=\{[\s\S]*?Download/)
  })
})
