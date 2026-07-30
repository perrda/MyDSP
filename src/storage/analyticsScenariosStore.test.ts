import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteAnalyticsScenario,
  loadAnalyticsScenarios,
  saveAnalyticsScenario,
} from './analyticsScenariosStore'

function mockLocalStorage() {
  const memory = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, String(value)),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
      key: (index: number) => [...memory.keys()][index] ?? null,
      get length() {
        return memory.size
      },
    },
  })
}

describe('analyticsScenariosStore', () => {
  beforeEach(mockLocalStorage)

  it('keeps named scenarios isolated per portfolio', () => {
    saveAnalyticsScenario('personal', 'Career break', {
      incomeDeltaPct: -25,
      marketReturnPct: 4,
      inflationPct: 3.5,
    })
    saveAnalyticsScenario('family', 'School fees', {
      incomeDeltaPct: 0,
      marketReturnPct: 5,
      inflationPct: 6,
    })

    expect(loadAnalyticsScenarios('personal')).toMatchObject([
      {
        portfolioId: 'personal',
        name: 'Career break',
        incomeDeltaPct: -25,
      },
    ])
    expect(loadAnalyticsScenarios('family')).toHaveLength(1)
  })

  it('updates and deletes a scenario without affecting another portfolio', () => {
    const saved = saveAnalyticsScenario('personal', 'Base case', {
      incomeDeltaPct: 0,
      marketReturnPct: 5,
      inflationPct: 3,
    })
    saveAnalyticsScenario('family', 'Base case', {
      incomeDeltaPct: 2,
      marketReturnPct: 6,
      inflationPct: 4,
    })

    const updated = saveAnalyticsScenario(
      'personal',
      'Base case',
      { incomeDeltaPct: 10, marketReturnPct: 7, inflationPct: 2 },
      saved.id,
    )
    expect(updated.id).toBe(saved.id)
    expect(loadAnalyticsScenarios('personal')[0]?.incomeDeltaPct).toBe(10)
    expect(deleteAnalyticsScenario('personal', saved.id)).toBe(true)
    expect(loadAnalyticsScenarios('personal')).toEqual([])
    expect(loadAnalyticsScenarios('family')).toHaveLength(1)
  })
})
