import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('next-10 wave 4 crypto accounting honesty', () => {
  it('states transfer and staking boundaries where users act on them', () => {
    const detail = readFileSync(resolve(__dirname, '../pages/HoldingDetailPage.tsx'), 'utf8')
    const crypto = readFileSync(resolve(__dirname, '../pages/CryptoPage.tsx'), 'utf8')
    const staking = readFileSync(resolve(__dirname, '../pages/StakingPage.tsx'), 'utf8')

    expect(detail).toMatch(/does not change holding/)
    expect(detail).toMatch(/separate manual ledger/)
    expect(detail).toMatch(/cost basis/)
    expect(detail).toMatch(/P&amp;L/)

    expect(crypto).toMatch(/crypto-manual-ledgers-note/)
    expect(crypto).toMatch(/never change quantity/)
    expect(crypto).toMatch(/do not book P&amp;L/)

    expect(staking).toMatch(/staking-manual-ledger-note/)
    expect(staking).toMatch(/Manual ledger/)
    expect(staking).toMatch(/Record any holding or tax changes separately/)
  })
})
