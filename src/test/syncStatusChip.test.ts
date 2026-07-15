import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('SyncStatusChip', () => {
  it('shows relative synced time without a separate Now button', () => {
    const src = readFileSync(resolve(__dirname, '../components/SyncStatusChip.tsx'), 'utf8')
    expect(src).toMatch(/Synced · \$\{ago\}/)
    expect(src).not.toMatch(/syncNow/)
    expect(src).not.toMatch(/aria-label="Sync now"/)
    expect(src).not.toMatch(/>\{syncing \? '…' : 'Now'\}</)
  })
})
