import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEmptyPortfolio } from '../domain/defaults'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { applyRemoteAsBook, type MergePreview } from '../services/sync/syncService'
import {
  applyFamilyHoldingsToNamedBooks,
  listPortfolios,
  loadPortfolio,
  savePortfolioImmediate,
} from '../storage/portfolioStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function shares(data: { equities: { symbol: string; shares: number }[] }, symbol: string) {
  return data.equities.find((e) => e.symbol === symbol)?.shares
}

function qty(data: { crypto: { symbol: string; qty: number }[] }, symbol: string) {
  return data.crypto.find((c) => c.symbol === symbol)?.qty
}

function replacePreview(): MergePreview {
  const local = createEmptyPortfolio()
  const remote = createEmptyPortfolio()
  remote.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 12.5, price: 85000, cost: 400_000 }]
  const mum = createEmptyPortfolio()
  const thomas = createEmptyPortfolio()
  const andrew = createEmptyPortfolio()
  return {
    source: 'pull',
    portfolios: [
      { portfolioId: 'default', isNew: false, local, remote, conflicts: [] },
      { portfolioId: 'mum', isNew: true, local: null, remote: mum, conflicts: [] },
      { portfolioId: 'thomas', isNew: true, local: null, remote: thomas, conflicts: [] },
      { portfolioId: 'andrew', isNew: true, local: null, remote: andrew, conflicts: [] },
    ],
    registryPortfolios: [
      { id: 'default', name: 'David', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'mum', name: 'Mum', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'thomas', name: 'Thomas', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'andrew', name: 'Andrew', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    remoteRegistry: [
      { id: 'default', name: 'David', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'mum', name: 'Mum', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'thomas', name: 'Thomas', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'andrew', name: 'Andrew', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    activePortfolioId: 'default',
    conflicts: [],
  }
}

describe('MyDSP 1.2.146 family sleeves land on live after Mini REPLACE', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(read('../../package.json'))
    expect(pkg.version).toBe('1.2.162')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.162')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.162',
      '1.2.161',
      '1.2.160',
      '1.2.159',
      '1.2.158',
    ])
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.146\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/v2/)
    expect(section).toMatch(/REPLACE/)
    expect(section).toMatch(/Mum/)
    expect(section).toMatch(/Thomas/)
    expect(section).toMatch(/James King/)
    expect(section).toMatch(/Andrew/)
    expect(section).toMatch(/295/)
    expect(section).toMatch(/14,285 ADA/)
    expect(section).toMatch(/BTC 0/)
    expect(section).toMatch(/unpriced/)
    expect(section).toMatch(/#F7931A/)
    expect(section).not.toMatch(/SYNC_KEY/)
    expect(read('../../ROADMAP.md')).toMatch(/Family sleeves land on live \(v1\.2\.146\)/)
    expect(read('../domain/familyHoldingSleeves.ts')).toMatch(/FAMILY_SLEEVES_APPLIED_VERSION = 'v3'/)
    expect(read('../../public/sw.js')).toMatch(/mydsp-v1\.2\.162/)
    expect(read('../services/sync/syncService.ts')).toMatch(/applyFamilyHoldingsToNamedBooks\(\)/)
    expect(read('../context/PortfolioContext.tsx')).toMatch(/familyHoldingSleeveFor/)
  })

  it('re-applies gifted shares after satellite REPLACE of empty Mini books', async () => {
    localStorage.clear()
    savePortfolioImmediate(createEmptyPortfolio(), 'default')
    await applyRemoteAsBook(replacePreview())
    const names = listPortfolios().map((p) => p.name)
    expect(names).toEqual(expect.arrayContaining(['David', 'Mum', 'Thomas', 'Andrew']))
    const mum = listPortfolios().find((p) => p.name === 'Mum')!
    const thomas = listPortfolios().find((p) => p.name === 'Thomas')!
    const andrew = listPortfolios().find((p) => p.name === 'Andrew')!
    expect(shares(loadPortfolio(mum.id), 'TSLA')).toBe(109)
    expect(shares(loadPortfolio(mum.id), 'MSTR')).toBe(108)
    expect(shares(loadPortfolio(thomas.id), 'TSLA')).toBe(100)
    expect(shares(loadPortfolio(thomas.id), 'MSTR')).toBe(97)
    expect(loadPortfolio(andrew.id).equities.map((e) => [e.symbol, e.shares, e.accountType ?? 'general'])).toEqual([
      ['TSLA', 295, 'sipp'],
      ['MSTR', 197, 'sipp'],
      ['TSLA', 135, 'general'],
      ['MSTR', 112, 'general'],
    ])
    expect(qty(loadPortfolio(andrew.id), 'ADA')).toBe(14285)
    expect(qty(loadPortfolio(andrew.id), 'BTC')).toBeUndefined()
    expect(applyFamilyHoldingsToNamedBooks()).toEqual([])
    expect(qty(loadPortfolio(mum.id), 'ADA')).toBeUndefined()
  })
})
