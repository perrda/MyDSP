import { useMemo, useState, useTransition } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { Field, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { runMonteCarlo } from '../domain/monteCarlo'
import {
  calcAllocation,
  calcRebalanceActions,
  driftStatus,
  normalizeTargets,
} from '../domain/rebalance'
import { formatGBP, formatPct, privacyClass } from '../utils/format'

export function PlanningPage() {
  const { data, setData, breakdown, privacy } = usePortfolio()
  const [tab, setTab] = useState<'rebalance' | 'montecarlo'>('rebalance')
  const [pending, startTransition] = useTransition()
  const [mcYears, setMcYears] = useState('10')
  const [mcSims, setMcSims] = useState('5000')
  const [mcMean, setMcMean] = useState(String(data.fireInputs.returnRate || 7))
  const [mcVol, setMcVol] = useState('18')
  const [mcResult, setMcResult] = useState(() =>
    runMonteCarlo({
      currentValue: breakdown.netWorth,
      monthlyContribution: data.fireInputs.savings || 0,
      years: 10,
      simulations: 2000,
      meanReturn: (data.fireInputs.returnRate || 7) / 100,
      stdDev: 0.18,
    }),
  )

  const alloc = useMemo(
    () => calcAllocation(breakdown.equity.value, data.crypto),
    [breakdown.equity.value, data.crypto],
  )
  const targets = normalizeTargets(data.targetAllocations)
  const actions = useMemo(
    () => calcRebalanceActions(alloc, data.targetAllocations, 1),
    [alloc, data.targetAllocations],
  )

  const setTarget = (key: keyof typeof targets, raw: string) => {
    const n = parseNum(raw)
    setData((prev) => ({
      ...prev,
      targetAllocations: { ...prev.targetAllocations, [key]: n },
    }))
  }

  const runMc = () => {
    startTransition(() => {
      setMcResult(
        runMonteCarlo({
          currentValue: breakdown.netWorth,
          monthlyContribution: data.fireInputs.savings || 0,
          years: parseNum(mcYears) || 10,
          simulations: parseNum(mcSims) || 5000,
          meanReturn: (parseNum(mcMean) || 7) / 100,
          stdDev: (parseNum(mcVol) || 18) / 100,
        }),
      )
    })
  }

  const buckets: { key: 'equity' | 'crypto' | 'cash'; label: string; current: number; target: number }[] =
    [
      { key: 'equity', label: 'Equities', current: alloc.equityPct, target: targets.equity },
      { key: 'crypto', label: 'Crypto', current: alloc.cryptoPct, target: targets.crypto },
      { key: 'cash', label: 'Cash / stables', current: alloc.cashPct, target: targets.cash },
    ]

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Rebalance & Monte Carlo"
        description="Target allocation drift and projected net-worth paths."
      />

      <div className="flex gap-2 mb-8">
        {(['rebalance', 'montecarlo'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'rebalance' ? 'Rebalance' : 'Monte Carlo'}
          </button>
        ))}
      </div>

      {tab === 'rebalance' && (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-px mb-8 ${privacyClass(privacy)}`}>
            <StatCard label="Investable total" value={formatGBP(alloc.total)} />
            <StatCard label="Equity" value={`${alloc.equityPct.toFixed(1)}%`} hint={formatGBP(alloc.equity)} />
            <StatCard
              label="Crypto / cash"
              value={`${(alloc.cryptoPct + alloc.cashPct).toFixed(1)}%`}
              hint={`Crypto ${formatGBP(alloc.crypto)} · Cash ${formatGBP(alloc.cash)}`}
            />
          </div>

          <div className="surface p-6 sm:p-8 mb-px">
            <p className="eyebrow mb-6">Target allocation %</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              {(
                [
                  ['equity', 'Equities %', targets.equity],
                  ['crypto', 'Crypto %', targets.crypto],
                  ['cash', 'Cash %', targets.cash],
                ] as const
              ).map(([key, label, value]) => (
                <Field key={key} label={label}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={String(Math.round(value * 10) / 10)}
                    onChange={(e) => setTarget(key, e.target.value)}
                  />
                </Field>
              ))}
            </div>

            <div className="space-y-5">
              {buckets.map((b) => {
                const status = driftStatus(b.current, b.target)
                return (
                  <div key={b.key}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold uppercase tracking-wider text-xs">
                        {b.label}
                        <span
                          className={`ml-2 text-[10px] ${
                            status === 'alert'
                              ? 'text-text-muted'
                              : status === 'warning'
                                ? 'text-accent'
                                : 'text-text-subtle'
                          }`}
                        >
                          {status}
                        </span>
                      </span>
                      <span className={privacyClass(privacy)}>
                        {b.current.toFixed(1)}% → {b.target.toFixed(1)}%
                      </span>
                    </div>
                    <div className="progress-track mb-1">
                      <div className="progress-fill" style={{ width: `${Math.min(100, b.current)}%` }} />
                    </div>
                    <div className="progress-track opacity-40">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, b.target)}%`, background: 'var(--text-subtle)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="surface p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="eyebrow mb-0">Suggested trades</p>
              {actions.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    const startId = data.journal.reduce((m, j) => Math.max(m, j.id), 0) + 1
                    const today = new Date().toISOString().slice(0, 10)
                    setData((prev) => ({
                      ...prev,
                      journal: [
                        ...prev.journal,
                        ...actions.map((a, i) => ({
                          id: startId + i,
                          date: today,
                          type: 'transfer' as const,
                          asset: a.bucket.toUpperCase(),
                          qty: 0,
                          price: 0,
                          fees: 0,
                          total: a.amount,
                          notes: `Rebalance suggestion: ${a.type} ${a.bucket} ${formatGBP(a.amount)} (${a.currentPct.toFixed(1)}% → ${a.targetPct.toFixed(1)}%)`,
                        })),
                      ],
                    }))
                  }}
                >
                  Log suggestions to journal
                </button>
              )}
            </div>
            {actions.length === 0 ? (
              <p className="text-sm text-text-subtle">Within 1% of targets — no action needed.</p>
            ) : (
              <ul className="space-y-3">
                {actions.map((a) => (
                  <li key={a.bucket} className="flex justify-between gap-4 text-sm">
                    <span className="uppercase tracking-wider text-xs font-bold">
                      {a.type} {a.bucket}
                    </span>
                    <span className={`tabular-nums font-semibold ${privacyClass(privacy)}`}>
                      {formatGBP(a.amount)} ({formatPct(a.pctDiff)})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === 'montecarlo' && (
        <>
          <div className="surface p-6 sm:p-8 mb-px">
            <p className="eyebrow mb-4">Assumptions</p>
            <p className="text-sm text-text-muted mb-6 font-light">
              Starting NW {formatGBP(breakdown.netWorth)} · Monthly contribution from FIRE savings (
              {formatGBP(data.fireInputs.savings)})
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Field label="Years">
                <input type="text" inputMode="numeric" value={mcYears} onChange={(e) => setMcYears(e.target.value)} />
              </Field>
              <Field label="Simulations">
                <input type="text" inputMode="numeric" value={mcSims} onChange={(e) => setMcSims(e.target.value)} />
              </Field>
              <Field label="Mean return %">
                <input type="text" inputMode="decimal" value={mcMean} onChange={(e) => setMcMean(e.target.value)} />
              </Field>
              <Field label="Volatility %">
                <input type="text" inputMode="decimal" value={mcVol} onChange={(e) => setMcVol(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {(
                [
                  ['Bear', 4, 22],
                  ['Base', 7, 18],
                  ['Bull', 10, 14],
                ] as const
              ).map(([label, mean, vol]) => (
                <button
                  key={label}
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setMcMean(String(mean))
                    setMcVol(String(vol))
                    startTransition(() => {
                      setMcResult(
                        runMonteCarlo({
                          currentValue: breakdown.netWorth,
                          monthlyContribution: data.fireInputs.savings || 0,
                          years: parseNum(mcYears) || 10,
                          simulations: parseNum(mcSims) || 5000,
                          meanReturn: mean / 100,
                          stdDev: vol / 100,
                        }),
                      )
                    })
                  }}
                >
                  {label} ({mean}% / {vol}%)
                </button>
              ))}
            </div>
            <button type="button" className="btn-primary" onClick={runMc} disabled={pending}>
              {pending ? 'Running…' : 'Run simulation'}
            </button>
          </div>

          <div className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-px mb-8 ${privacyClass(privacy)}`}>
            <StatCard label="p5" value={formatGBP(mcResult.p5, { compact: true })} />
            <StatCard label="p25" value={formatGBP(mcResult.p25, { compact: true })} />
            <StatCard label="p50" value={formatGBP(mcResult.p50, { compact: true })} />
            <StatCard label="p75" value={formatGBP(mcResult.p75, { compact: true })} />
            <StatCard label="p95" value={formatGBP(mcResult.p95, { compact: true })} />
            <StatCard label="Expected" value={formatGBP(mcResult.expected, { compact: true })} />
          </div>

          <div className="surface p-4 sm:p-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mcResult.bands}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} />
                <YAxis
                  tickFormatter={(v: number) => formatGBP(v, { compact: true })}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}
                  width={64}
                />
                <Tooltip
                  formatter={(v) => formatGBP(Number(v))}
                  labelFormatter={(y) => `Year ${y}`}
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 0,
                    color: 'var(--text)',
                  }}
                  labelStyle={{ color: 'var(--text-muted)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Area type="monotone" dataKey="p95" stroke="transparent" fill="var(--accent)" fillOpacity={0.12} />
                <Area type="monotone" dataKey="p5" stroke="transparent" fill="var(--bg)" fillOpacity={1} />
                <Area type="monotone" dataKey="p50" stroke="var(--accent)" fill="none" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary planning actions">
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => setTab('montecarlo')}
        >
          Monte Carlo
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setTab('rebalance')}
        >
          Rebalance
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
