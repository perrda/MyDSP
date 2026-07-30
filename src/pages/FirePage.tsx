import { useMemo, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { Field, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { calcFire, type FireType } from '../domain/fire'
import { formatGBP, privacyClass } from '../utils/format'

const TYPES: { id: FireType; label: string }[] = [
  { id: 'lean', label: 'Lean' },
  { id: 'regular', label: 'Regular' },
  { id: 'fat', label: 'Fat' },
  { id: 'coast', label: 'Coast' },
]

export function FirePage() {
  const { data, breakdown, setData, privacy } = usePortfolio()
  const [type, setType] = useState<FireType>('regular')
  const inputs = data.fireInputs

  const result = useMemo(
    () => calcFire(breakdown.netWorth, inputs, type),
    [breakdown.netWorth, inputs, type],
  )

  const update = (key: keyof typeof inputs, raw: string) => {
    const value = parseNum(raw)
    setData((prev) => ({
      ...prev,
      fireInputs: { ...prev.fireInputs, [key]: value },
    }))
  }

  const yearsLabel = (y: number) => {
    if (!Number.isFinite(y)) return 'Unreachable'
    if (y <= 0) return 'Achieved'
    return `${y.toFixed(1)} years`
  }

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="FIRE calculator"
        description="Lean, regular, fat, and coast FIRE from your live net worth."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-8">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`surface p-5 text-left border ${
              type === t.id ? 'border-accent' : 'border-transparent'
            }`}
          >
            <p className="eyebrow mb-2">{t.label}</p>
            <p className={`text-xl font-bold tabular-nums ${privacyClass(privacy)}`}>
              {formatGBP(
                t.id === 'lean'
                  ? result.leanTarget
                  : t.id === 'fat'
                    ? result.fatTarget
                    : t.id === 'coast'
                      ? result.coastTarget
                      : result.regularTarget,
              )}
            </p>
            <p className="text-sm text-text-subtle mt-2">
              {yearsLabel(
                t.id === 'lean'
                  ? result.leanYears
                  : t.id === 'fat'
                    ? result.fatYears
                    : t.id === 'coast'
                      ? result.coastYears
                      : result.regularYears,
              )}
            </p>
          </button>
        ))}
      </div>

      <div className={`surface p-6 sm:p-10 mb-px ${privacyClass(privacy)}`}>
        <p className="label-uppercase mb-2">FIRE number ({type})</p>
        <p className="text-4xl font-bold tracking-tight text-accent mb-4">
          {formatGBP(result.currentTarget)}
        </p>
        <div className="progress-track mb-3">
          <div className="progress-fill" style={{ width: `${result.progress}%` }} />
        </div>
        <p className="text-sm text-text-muted">
          {result.progress.toFixed(1)}% of target · Current NW {formatGBP(breakdown.netWorth)} ·
          Years {yearsLabel(result.currentYears)} · Age at FIRE {result.ageAtFire}
        </p>
      </div>

      <div className="surface p-6 sm:p-8">
        <p className="eyebrow mb-6">Assumptions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(
            [
              ['expenses', 'Annual expenses (GBP)', inputs.expenses],
              ['savings', 'Monthly savings (GBP)', inputs.savings],
              ['returnRate', 'Return rate %', inputs.returnRate],
              ['swr', 'Safe withdrawal %', inputs.swr],
              ['age', 'Current age', inputs.age],
              ['pensionAge', 'Pension age', inputs.pensionAge],
            ] as const
          ).map(([key, label, value]) => (
            <Field key={key} label={label}>
              <input
                type="text"
                inputMode="decimal"
                value={Number.isFinite(value) ? String(value) : ''}
                onChange={(e) => update(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <p className="mt-6 text-sm text-text-subtle font-light">
          Passive income at current NW ({inputs.swr}% SWR):{' '}
          <span className="text-accent font-semibold">{formatGBP(result.passiveIncome)}</span> / year
        </p>
      </div>
    </div>
  )
}
