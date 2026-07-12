/** Cardano-style staking rewards helpers. */

import type { CryptoHolding, StakingReward, StakingState } from './types'

const EPOCH_START = new Date('2020-07-29T21:44:51Z')
const EPOCH_DAYS = 5

export function currentEpoch(now = new Date()): number {
  const days = (now.getTime() - EPOCH_START.getTime()) / (86400 * 1000)
  return 208 + Math.floor(days / EPOCH_DAYS)
}

export function emptyStaking(): StakingState {
  return {
    pool: { name: 'NORTH5', ticker: 'NORTH5' },
    rewards: [],
  }
}

export function getAdaHolding(crypto: CryptoHolding[]): { qty: number; price: number } {
  const ada = crypto.find((c) => c.symbol.toUpperCase() === 'ADA')
  return { qty: ada?.qty ?? 0, price: ada?.price ?? 0 }
}

export interface StakingSummary {
  totalAda: number
  totalGbp: number
  rewardCount: number
  avgMonthlyAda: number
  estimatedApy: number
  currentEpoch: number
  stakeAda: number
}

export function calcStakingSummary(
  staking: StakingState,
  crypto: CryptoHolding[],
): StakingSummary {
  const ada = getAdaHolding(crypto)
  const rewards = staking.rewards
  const totalAda = rewards.reduce((s, r) => s + r.amount, 0)
  const totalGbp = rewards.reduce((s, r) => {
    const px = r.priceAtTime && r.priceAtTime > 0 ? r.priceAtTime : ada.price
    return s + r.amount * px
  }, 0)
  const months = Math.max(1, rewards.length / 5)
  const avgMonthlyAda = totalAda / months
  const estimatedApy =
    ada.qty > 0 ? ((avgMonthlyAda * 12) / ada.qty) * 100 : rewards.length ? 3.5 : 0

  return {
    totalAda,
    totalGbp,
    rewardCount: rewards.length,
    avgMonthlyAda,
    estimatedApy,
    currentEpoch: currentEpoch(),
    stakeAda: ada.qty,
  }
}

export function epochApy(reward: StakingReward): number | null {
  if (!reward.stake || reward.stake <= 0) return null
  return (reward.amount / reward.stake) * 73 * 100
}
