/**
 * Detect whether this device already holds a real book (Mini DAVID = source of truth).
 * Empty slates and the FCC sample seed are “wrong books” — first Sync should pull.
 */

import { createEmptyPortfolio, createSamplePortfolio } from '../../domain/defaults'
import type { PortfolioData } from '../../domain/types'
import { listPortfolios, loadPortfolio } from '../../storage/portfolioStore'

const SAMPLE_CRYPTO_FP = fingerprintCrypto(createSamplePortfolio())
const SAMPLE_EQUITY_FP = fingerprintEquities(createSamplePortfolio())

function fingerprintCrypto(data: PortfolioData): string {
  return data.crypto
    .map((c) => `${c.symbol}:${c.qty}`)
    .sort()
    .join(',')
}

function fingerprintEquities(data: PortfolioData): string {
  return data.equities
    .map((e) => `${e.symbol}:${e.shares}`)
    .sort()
    .join(',')
}

function bookWeight(data: PortfolioData): number {
  return (
    data.crypto.length +
    data.equities.length +
    data.spending.length +
    data.journal.length +
    data.creditCards.length +
    data.loans.length +
    data.recurringTransactions.length +
    data.todoItems.length +
    data.jobApplications.length +
    data.goals.length +
    (data.merchantRules?.length ?? 0) +
    (data.staking?.rewards?.length ?? 0)
  )
}

export function isEmptyBook(data: PortfolioData): boolean {
  return bookWeight(data) === 0
}

/** FCC first-run sample: known BTC 0.05 / VWRL 50 seed, no spending ledger. */
export function isSampleBook(data: PortfolioData): boolean {
  if (data.spending.length > 0 || data.journal.length > 0) return false
  return fingerprintCrypto(data) === SAMPLE_CRYPTO_FP && fingerprintEquities(data) === SAMPLE_EQUITY_FP
}

export function isEmptyOrSampleBook(data: PortfolioData): boolean {
  return isEmptyBook(data) || isSampleBook(data)
}

export function localBookIsSourceOfTruth(): boolean {
  try {
    const list = listPortfolios()
    return list.some((p) => !isEmptyOrSampleBook(loadPortfolio(p.id)))
  } catch {
    return !isEmptyOrSampleBook(createEmptyPortfolio())
  }
}

/**
 * 1.2.127 — do not infer “this is Mini” from a real local DAVID.
 * A MacBook with a wrong book and empty lastSyncAt used to PUSH and overwrite Mini.
 * Push only when this device is the book. Satellites always choose pull;
 * `runOneButtonSync` may still push on cloud 404 (empty store).
 */
export function chooseFirstSyncAction(input: {
  localHasBook: boolean
  alreadySynced: boolean
  isBookDevice?: boolean
}): 'push' | 'pull' {
  if (input.isBookDevice === true) return 'push'
  return 'pull'
}

/** Alias: book device always pushes; satellite always pulls when cloud has an envelope. */
export function chooseSyncAction(input: { isBookDevice: boolean }): 'push' | 'pull' {
  return chooseFirstSyncAction({
    localHasBook: false,
    alreadySynced: false,
    isBookDevice: input.isBookDevice,
  })
}
