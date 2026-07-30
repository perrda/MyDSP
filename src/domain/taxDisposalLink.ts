export type TaxDisposalAssetType = 'equity' | 'crypto'

export interface TaxDisposalLinkInput {
  symbol: string
  assetType: TaxDisposalAssetType
  date: string
  qty: number
  proceeds: number
  cost: number
}

/** Build the Tax-page prefill link used after recording a disposal. */
export function buildTaxDisposalHref(input: TaxDisposalLinkInput): string {
  const params = new URLSearchParams()
  params.set('assetType', input.assetType)
  params.set('symbol', input.symbol)
  params.set('date', input.date)
  params.set('qty', String(input.qty))
  params.set('proceeds', String(Math.max(0, input.proceeds)))
  params.set('cost', String(Math.max(0, input.cost)))
  return `/tax?${params.toString()}`
}
