import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RELEASE_NOTES, releaseNotesArchive } from '../domain/releaseNotes'
import {
  addYoutubeChannel,
  exportYoutubeForBackup,
  importYoutubeFromBackup,
  listYoutubeChannels,
  loadYoutubeState,
  removeYoutubeChannel,
} from '../storage/youtubeStore'
import {
  addNewsTag,
  exportNewsForBackup,
  importNewsFromBackup,
  listNewsTags,
  loadNewsState,
  removeNewsTag,
} from '../storage/newsStore'

const mem = new Map<string, string>()

describe('Media cross-device sync (v1.2.95)', () => {
  beforeEach(() => {
    mem.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
      removeItem: (k: string) => {
        mem.delete(k)
      },
      clear: () => mem.clear(),
    })
  })

  afterEach(() => {
    mem.clear()
    vi.unstubAllGlobals()
  })

  it('package + release notes tip', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.version).toBe('1.2.95')
    expect(RELEASE_NOTES[0]?.version).toBe('1.2.95')
    expect(releaseNotesArchive(5).map((e) => e.version)).toEqual([
      '1.2.95',
      '1.2.94',
      '1.2.93',
      '1.2.92',
      '1.2.91',
    ])
  })

  it('empty YouTube/News seed is silent (does not mark workspace dirty)', () => {
    const yt = readFileSync(resolve(__dirname, '../storage/youtubeStore.ts'), 'utf8')
    const news = readFileSync(resolve(__dirname, '../storage/newsStore.ts'), 'utf8')
    const markets = readFileSync(resolve(__dirname, '../storage/marketsStore.ts'), 'utf8')
    expect(yt).toMatch(/writeState\(seeded,\s*\{\s*silent:\s*true\s*\}\)/)
    expect(news).toMatch(/writeState\(seeded,\s*\{\s*silent:\s*true\s*\}\)/)
    expect(markets).toMatch(/writeState\(seeded,\s*\{\s*silent:\s*true\s*\}\)/)
    // Behavioral: first load creates key without requiring a prior dirty write path
    expect(loadYoutubeState().channels).toEqual([])
    expect(mem.get('mydsp_youtube_v1')).toBeTruthy()
    expect(loadNewsState().tags.length).toBeGreaterThan(0)
  })

  it('YouTube channels union + deletion tombstones across devices', () => {
    addYoutubeChannel({
      channelId: 'UC_ipad',
      title: 'iPad channel',
      url: 'https://www.youtube.com/channel/UC_ipad',
    })
    addYoutubeChannel({
      channelId: 'UC_shared',
      title: 'Shared',
      url: 'https://www.youtube.com/channel/UC_shared',
    })
    const fromIpad = exportYoutubeForBackup()

    mem.clear()
    addYoutubeChannel({
      channelId: 'UC_web',
      title: 'Web channel',
      url: 'https://www.youtube.com/channel/UC_web',
    })
    importYoutubeFromBackup(fromIpad)
    expect(listYoutubeChannels().map((c) => c.channelId).sort()).toEqual([
      'UC_ipad',
      'UC_shared',
      'UC_web',
    ])

    const shared = listYoutubeChannels().find((c) => c.channelId === 'UC_shared')!
    removeYoutubeChannel(shared.id)
    const afterRemove = exportYoutubeForBackup()
    expect(afterRemove.deletedChannels?.some((d) => d.channelId === 'UC_shared')).toBe(true)

    // Other device still has UC_shared — tombstone must win on import
    mem.clear()
    addYoutubeChannel({
      channelId: 'UC_shared',
      title: 'Shared again',
      url: 'https://www.youtube.com/channel/UC_shared',
    })
    importYoutubeFromBackup(afterRemove)
    expect(listYoutubeChannels().map((c) => c.channelId)).not.toContain('UC_shared')
  })

  it('News tags union + deletion tombstones across devices', () => {
    addNewsTag({ tag: 'NIGHT', label: 'Midnight' })
    const fromIpad = exportNewsForBackup()
    mem.clear()
    addNewsTag({ tag: 'SOL', label: 'Solana' })
    importNewsFromBackup(fromIpad)
    const tags = listNewsTags().map((t) => t.tag)
    expect(tags).toContain('NIGHT')
    expect(tags).toContain('SOL')

    const night = listNewsTags().find((t) => t.tag === 'NIGHT')!
    removeNewsTag(night.id)
    const afterRemove = exportNewsForBackup()
    expect(afterRemove.deletedTags?.some((d) => d.tag === 'NIGHT')).toBe(true)

    mem.clear()
    addNewsTag({ tag: 'NIGHT', label: 'Resurrected' })
    importNewsFromBackup(afterRemove)
    expect(listNewsTags().map((t) => t.tag)).not.toContain('NIGHT')
  })

  it('portfolio conflicts do not block workspace extras apply', () => {
    const sync = readFileSync(resolve(__dirname, '../services/sync/syncService.ts'), 'utf8')
    const auto = readFileSync(resolve(__dirname, '../services/sync/autoSyncService.ts'), 'utf8')
    expect(sync).toMatch(/export async function applyWorkspaceExtrasFromPreview/)
    expect(sync).toMatch(/Portfolio conflicts must not block YouTube/)
    expect(auto).toMatch(/applyWorkspaceExtrasFromPreview\(preview\)/)
    expect(auto).toMatch(/Portfolio conflicts must not block YouTube/)
  })

  it('Cursor rule + smoke docs lock media cross-device sync', () => {
    const rule = readFileSync(
      resolve(__dirname, '../../.cursor/rules/media-cross-device-sync.mdc'),
      'utf8',
    )
    expect(rule).toMatch(/alwaysApply:\s*true/)
    expect(rule).toMatch(/silent:\s*true/)
    expect(rule).toMatch(/web, tablet, and mobile/)
    expect(rule).toMatch(/applyWorkspaceExtrasFromPreview/)
    const smoke = readFileSync(resolve(__dirname, '../../scripts/SYNC_SMOKE.md'), 'utf8')
    expect(smoke).toMatch(/deletion tombstones/)
    expect(smoke).toMatch(/web \/ tablet \/ mobile/)
    const setup = readFileSync(resolve(__dirname, '../../SYNC_SETUP.md'), 'utf8')
    expect(setup).toMatch(/deletion tombstones \+ seenAt LWW/)
  })
})
