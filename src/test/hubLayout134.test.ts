import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HOUSEHOLD_DOORS, MONEY_DIRECTORY, MONEY_DOORS, PLAN_DOORS } from '../domain/hubPages'
import {
  exportHubLayoutForBackup,
  importHubLayoutFromBackup,
  loadHubLayout,
  orderHubDoors,
  saveHubLayout,
} from '../storage/hubLayoutStore'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('MyDSP 1.2.134 Money / Plan hub reorder', () => {
  beforeEach(() => {
    mockLocalStorage()
    vi.stubGlobal('window', {
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reorders doors and directory, then LWW-imports the newer remote', () => {
    const flippedDoors = [...MONEY_DOORS].reverse().map((d) => d.to)
    const flippedDir = [...MONEY_DIRECTORY].reverse().map((d) => d.to)
    const flippedPlan = [...PLAN_DOORS].reverse().map((d) => d.to)
    const flippedHousehold = [...HOUSEHOLD_DOORS].reverse().map((d) => d.to)
    const saved = saveHubLayout(
      {
        moneyDoors: flippedDoors,
        moneyDirectory: flippedDir,
        planDoors: flippedPlan,
        householdDoors: flippedHousehold,
      },
      { markDirty: false },
    )
    expect(loadHubLayout().moneyDoors[0]).toBe('/import')
    expect(loadHubLayout().moneyDirectory[0]).toBe('/rules')
    expect(loadHubLayout().planDoors[0]).toBe('/history')
    expect(loadHubLayout().householdDoors[0]).toBe('/review')
    expect(orderHubDoors(MONEY_DOORS, saved.moneyDoors).map((d) => d.label)[0]).toBe('Import')

    const older = {
      ...saved,
      moneyDoors: [...MONEY_DOORS.map((d) => d.to)],
      updatedAt: '2020-01-01T00:00:00.000Z',
    }
    importHubLayoutFromBackup(older)
    expect(loadHubLayout().moneyDoors[0]).toBe('/import')

    const newer = {
      ...saved,
      moneyDoors: [...MONEY_DOORS.map((d) => d.to)],
      updatedAt: '2030-01-01T00:00:00.000Z',
    }
    importHubLayoutFromBackup(newer)
    expect(loadHubLayout().moneyDoors[0]).toBe('/spending')
    expect(exportHubLayoutForBackup()?.planDoors[0]).toBe('/history')
  })

  it('Money and Plan pages use ReorderList + hub layout store', () => {
    const money = read('../pages/MoneyPage.tsx')
    expect(money).toMatch(/ReorderList/)
    expect(money).toMatch(/ReorderHandle/)
    expect(money).toMatch(/saveHubLayout/)
    expect(money).toMatch(/moneyDoors/)
    expect(money).toMatch(/moneyDirectory/)
    expect(money).toMatch(/MONEY_DOORS/)
    expect(money).toMatch(/MONEY_DIRECTORY/)
    expect(money).toMatch(/money-directory/)
    expect(money).not.toMatch(/overflow-hidden/)
    const plan = read('../pages/PlanPage.tsx')
    expect(plan).toMatch(/ReorderList/)
    expect(plan).toMatch(/planDoors/)
    expect(plan).toMatch(/PLAN_DOORS/)
    const household = read('../pages/FamilyPage.tsx')
    expect(household).toMatch(/ReorderList/)
    expect(household).toMatch(/householdDoors/)
    expect(household).toMatch(/HOUSEHOLD_DOORS/)
  })

  it('hub layout rides fullArchive extras like Today layout', () => {
    const backup = read('../storage/backupStore.ts')
    expect(backup).toMatch(/exportHubLayoutForBackup/)
    expect(backup).toMatch(/importHubLayoutFromBackup/)
    const sync = read('../services/sync/syncService.ts')
    expect(sync).toMatch(/hubLayout/)
    expect(sync).toMatch(/importHubLayoutFromBackup/)
    expect(sync).toMatch(/importYoutubeFromBackup/)
    expect(sync).toMatch(/importNewsFromBackup/)
    expect(sync).toMatch(/applyWorkspaceExtrasFromPreview/)
    const highlights = read('../services/sync/syncHighlights.ts')
    expect(highlights).toMatch(/Money \/ Plan layout/)
    const setup = read('../../SYNC_SETUP.md')
    expect(setup).toMatch(/Money \/ Plan \/ Household hub tile order/)
    const changelog = read('../../CHANGELOG.md')
    const section = changelog.match(/## \[1\.2\.134\][\s\S]*?(?=## \[)/)?.[0] ?? ''
    expect(section).toMatch(/Money \/ Plan \/ Household grab/)
    expect(section).toMatch(/News \/ YouTube extras/)
  })
})
