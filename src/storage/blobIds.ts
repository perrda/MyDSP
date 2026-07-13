import type { PortfolioData } from '../domain/types'

/** Collect blob IDs referenced by vault documents and job customDocuments. */
export function collectReferencedBlobIds(data: PortfolioData): number[] {
  const ids = new Set<number>()
  for (const d of data.documents ?? []) {
    if (d.hasBlob && typeof d.id === 'number') ids.add(d.id)
  }
  for (const job of data.jobApplications ?? []) {
    for (const doc of job.customDocuments ?? []) {
      if (doc.hasBlob && typeof doc.blobDocId === 'number') ids.add(doc.blobDocId)
    }
  }
  return [...ids]
}

export function collectBlobIdsFromPortfolios(portfolios: PortfolioData[]): number[] {
  const ids = new Set<number>()
  for (const p of portfolios) {
    for (const id of collectReferencedBlobIds(p)) ids.add(id)
  }
  return [...ids]
}
