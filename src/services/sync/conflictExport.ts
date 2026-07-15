/** Build a plaintext conflict review summary for download / share. */

import { summarizeConflict, summarizeConflictBatch, type SyncConflict } from './conflicts'

export function buildConflictSummaryText(conflicts: SyncConflict[]): string {
  const lines: string[] = [
    'MyDSP sync conflict summary',
    `Generated ${new Date().toLocaleString('en-GB')}`,
    `Conflicts: ${conflicts.length}`,
    '',
    summarizeConflictBatch(conflicts),
    '',
    '---',
  ]
  for (const c of conflicts) {
    lines.push('')
    lines.push(summarizeConflict(c))
    lines.push(`  portfolio: ${c.portfolioId}`)
    lines.push(`  collection: ${c.collection}`)
    lines.push(`  id: ${c.id}`)
    if (c.fieldDiffs?.length) {
      for (const d of c.fieldDiffs.slice(0, 12)) {
        lines.push(`  · ${d.field}: local=${d.local} | remote=${d.remote}`)
      }
    }
  }
  lines.push('')
  lines.push('Nothing was written until you Apply merge in Settings → Sync.')
  return lines.join('\n')
}

export function downloadConflictSummary(conflicts: SyncConflict[], filename?: string): void {
  const text = buildConflictSummaryText(conflicts)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `mydsp-conflicts-${new Date().toISOString().slice(0, 10)}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function shareConflictSummary(conflicts: SyncConflict[]): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const text = buildConflictSummaryText(conflicts)
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({
        title: 'MyDSP sync conflicts',
        text,
      })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    }
  }
  downloadConflictSummary(conflicts)
  return 'downloaded'
}
