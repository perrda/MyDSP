import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyPortfolio } from '../domain/defaults'
import {
  conflictKey,
  mergeWithResolutions,
  type SyncConflict,
} from '../services/sync/conflicts'
import { allConflictsResolved } from '../services/sync/syncService'
import {
  announceWhatArrived,
  firstSyncHighlightHref,
} from '../services/sync/syncHighlights'

const conflict = (portfolioId: string): SyncConflict => ({
  portfolioId,
  collection: 'todoItems',
  id: 7,
  localLabel: 'Local task',
  remoteLabel: 'Remote task',
})

describe('next-10 wave 4 sync conflict UX', () => {
  it('scopes same-id conflict choices by portfolio', () => {
    const home = conflict('home')
    const family = conflict('family')

    expect(conflictKey(home)).not.toBe(conflictKey(family))
    expect(
      allConflictsResolved([home, family], {
        [conflictKey(home)]: 'local',
      }),
    ).toBe(false)
  })

  it('applies the scoped row choice to its portfolio merge', () => {
    const local = createEmptyPortfolio()
    const remote = createEmptyPortfolio()
    local.todoItems = [
      {
        id: 7,
        listId: 1,
        title: 'Local task',
        status: 'todo',
        priority: 'medium',
        createdAt: '2026-07-30T10:00:00.000Z',
        updatedAt: '2026-07-30T10:00:00.000Z',
      },
    ]
    remote.todoItems = [{ ...local.todoItems[0]!, title: 'Remote task' }]

    const merged = mergeWithResolutions(
      local,
      remote,
      { [conflictKey(conflict('family'))]: 'remote' },
      'family',
    )

    expect(merged.todoItems?.[0]?.title).toBe('Remote task')
  })

  it('exposes per-row Apply, 10-second Undo, and Open first actions', () => {
    const sheet = readFileSync(resolve(__dirname, '../components/SyncConflictSheet.tsx'), 'utf8')
    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')

    expect(sheet).toMatch(/sync-conflict-keep-local/)
    expect(sheet).toMatch(/sync-conflict-keep-remote/)
    expect(sheet).toMatch(/sync-conflicts-apply/)
    expect(sheet).toMatch(/duration: BULK_UNDO_MS/)
    expect(settings).toMatch(/duration: 10_000/)
    expect(settings).toMatch(/label: 'Undo'/)
    expect(settings).toMatch(/label: 'Open first'/)
    expect(firstSyncHighlightHref({ todoItems: [42] })).toBe('/todos?focus=42')
  })

  it('announces the first-arrival destination to event consumers', () => {
    let openHref: string | null | undefined
    window.addEventListener(
      'mydsp-sync-applied',
      ((event: CustomEvent<{ openHref?: string | null }>) => {
        openHref = event.detail.openHref
      }) as EventListener,
      { once: true },
    )

    announceWhatArrived({ highlights: { jobApplications: [55] }, merged: 1 })

    expect(openHref).toBe('/jobs/55')
  })
})
