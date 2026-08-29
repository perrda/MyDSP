import { listUnpricedHoldings, unpricedExclusionCopy } from '../domain/calc'
import type { PortfolioData } from '../domain/types'

export function UnpricedExclusionBanner({ data }: { data: PortfolioData }) {
  const unpriced = listUnpricedHoldings(data)
  const copy = unpricedExclusionCopy(unpriced.length)
  if (!copy) return null
  const names = unpriced
    .map((h) => h.symbol || h.name)
    .filter(Boolean)
    .slice(0, 6)
    .join(', ')
  return (
    <p
      className="unpriced-exclusion text-xs text-text-subtle font-light mb-4"
      data-testid="unpriced-exclusion"
      role="status"
    >
      {copy}
      {names ? ` (${names}${unpriced.length > 6 ? '…' : ''})` : ''}
    </p>
  )
}
