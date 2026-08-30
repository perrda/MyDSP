import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import { youtubeTombstoneSuppressesChannel } from '../storage/youtubeStore'

describe('YouTube media sync unlock (v1.2.104)', () => {
  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.137')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.137')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.137',
      '1.2.134',
      '1.2.133',
      '1.2.132',
      '1.2.131',
    ])
  })

  it('tombstone recency: re-add wins, later delete wins', () => {
    const t1 = '2026-07-25T10:00:00.000Z'
    const t2 = '2026-07-25T11:00:00.000Z'
    expect(youtubeTombstoneSuppressesChannel(t1, t2)).toBe(false)
    expect(youtubeTombstoneSuppressesChannel(t2, t1)).toBe(true)
    expect(youtubeTombstoneSuppressesChannel(t1, t1)).toBe(false)
  })
})
