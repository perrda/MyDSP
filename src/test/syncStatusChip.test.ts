import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('SyncStatusChip', () => {
  it('shows relative synced time and links to Settings (no long-press sync)', () => {
    const src = readFileSync(resolve(__dirname, '../components/SyncStatusChip.tsx'), 'utf8')
    expect(src).toMatch(/Synced · \$\{ago\}/)
    expect(src).not.toMatch(/forceSyncNow/)
    expect(src).not.toMatch(/Long-press to sync now/)
    expect(src).toMatch(/Tap to open Settings/)
    expect(src).not.toMatch(/aria-label="Sync now"/)
    expect(src).not.toMatch(/>\{syncing \? '…' : 'Now'\}</)
  })
})
