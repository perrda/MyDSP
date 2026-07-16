import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('settings / forms polish batch', () => {
  it('sticks Settings search under the shell header', () => {
    const src = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(src).toMatch(/settings-search-sticky/)
    expect(src).toMatch(/Paste/)
    expect(src).toMatch(/showSyncPass/)
    expect(src).toMatch(/appearance-preview/)
    expect(src).toMatch(/shareBackupFile/)
  })

  it('adds Field errors, keyboard avoidance, and hold-to-confirm', () => {
    const src = readFileSync(resolve(__dirname, '../components/ui/Modal.tsx'), 'utf8')
    expect(src).toMatch(/error\?:/)
    expect(src).toMatch(/visualViewport/)
    expect(src).toMatch(/holdMs/)
    expect(src).toMatch(/Press and hold/)
  })

  it('adds decimal inputMode on salary and opening unit price', () => {
    const job = readFileSync(resolve(__dirname, '../components/JobFormModal.tsx'), 'utf8')
    expect(job).toMatch(/inputMode=\"decimal\"/)
    const open = readFileSync(resolve(__dirname, '../pages/OpeningBalanceWizardPage.tsx'), 'utf8')
    expect(open).toMatch(/inputMode=\"decimal\"/)
  })
})
