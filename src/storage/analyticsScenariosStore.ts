/** Named predictive-analytics assumptions, scoped to a portfolio and stored locally. */

const KEY = 'mydsp_analytics_scenarios_v1'

export interface AnalyticsScenarioValues {
  incomeDeltaPct: number
  marketReturnPct: number
  inflationPct: number
}

export interface AnalyticsScenario extends AnalyticsScenarioValues {
  id: string
  portfolioId: string
  name: string
  createdAt: string
  updatedAt: string
}

interface AnalyticsScenariosPayload {
  scenarios: AnalyticsScenario[]
  updatedAt: string
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeScenario(raw: unknown): AnalyticsScenario | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<AnalyticsScenario>
  if (
    typeof value.id !== 'string' ||
    typeof value.portfolioId !== 'string' ||
    typeof value.name !== 'string' ||
    !value.name.trim()
  ) {
    return null
  }
  const createdAt =
    typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString()
  return {
    id: value.id,
    portfolioId: value.portfolioId,
    name: value.name.trim(),
    incomeDeltaPct: finite(value.incomeDeltaPct, 0),
    marketReturnPct: finite(value.marketReturnPct, 5),
    inflationPct: finite(value.inflationPct, 3),
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  }
}

function readPayload(): AnalyticsScenariosPayload {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as
      | Partial<AnalyticsScenariosPayload>
      | null
    const scenarios = Array.isArray(parsed?.scenarios)
      ? parsed.scenarios
          .map(normalizeScenario)
          .filter((scenario): scenario is AnalyticsScenario => scenario != null)
      : []
    return {
      scenarios,
      updatedAt:
        typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return { scenarios: [], updatedAt: new Date(0).toISOString() }
  }
}

function writePayload(scenarios: AnalyticsScenario[], updatedAt: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ scenarios, updatedAt }))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mydsp-analytics-scenarios'))
    }
  } catch {
    /* private mode / storage unavailable */
  }
}

function nextId(): string {
  return `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadAnalyticsScenarios(portfolioId: string): AnalyticsScenario[] {
  return readPayload()
    .scenarios.filter((scenario) => scenario.portfolioId === portfolioId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveAnalyticsScenario(
  portfolioId: string,
  name: string,
  values: AnalyticsScenarioValues,
  scenarioId?: string,
): AnalyticsScenario {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Scenario name is required')

  const payload = readPayload()
  const existing = payload.scenarios.find(
    (scenario) =>
      scenario.portfolioId === portfolioId &&
      (scenario.id === scenarioId ||
        (!scenarioId && scenario.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())),
  )
  const now = new Date().toISOString()
  const next: AnalyticsScenario = {
    id: existing?.id ?? nextId(),
    portfolioId,
    name: cleanName,
    incomeDeltaPct: finite(values.incomeDeltaPct, 0),
    marketReturnPct: finite(values.marketReturnPct, 5),
    inflationPct: finite(values.inflationPct, 3),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  writePayload(
    existing
      ? payload.scenarios.map((scenario) => (scenario.id === existing.id ? next : scenario))
      : [...payload.scenarios, next],
    now,
  )
  return next
}

export function deleteAnalyticsScenario(portfolioId: string, scenarioId: string): boolean {
  const payload = readPayload()
  const scenarios = payload.scenarios.filter(
    (scenario) => !(scenario.portfolioId === portfolioId && scenario.id === scenarioId),
  )
  if (scenarios.length === payload.scenarios.length) return false
  writePayload(scenarios, new Date().toISOString())
  return true
}
