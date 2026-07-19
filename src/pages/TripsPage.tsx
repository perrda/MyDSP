import { useMemo, useState } from 'react'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { syncNow } from '../services/sync/autoSyncService'
import { calcSplitBalance, tripSpend } from '../domain/splits'
import type { Trip } from '../domain/types'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { formatDate, formatGBP, formatGBPPrecise, privacyClass } from '../utils/format'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

const emptyTrip = {
  name: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  budget: '',
  notes: '',
}

export function TripsPage() {
  const { data, setData, privacy } = usePortfolio()
  const { success: toastSuccess } = useToasts()
  const [tab, setTab] = useState<'trips' | 'splits'>('trips')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Trip | null>(null)
  const [form, setForm] = useState(emptyTrip)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [spendTripId, setSpendTripId] = useState<number | null>(null)

  const balance = useMemo(
    () => calcSplitBalance(data.spending, data.splitSettings),
    [data.spending, data.splitSettings],
  )

  const spendTrip = spendTripId != null ? data.trips.find((t) => t.id === spendTripId) : null
  const tripSpendRows = useMemo(() => {
    if (spendTripId == null) return []
    return data.spending
      .filter((s) => s.tripId === spendTripId)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [data.spending, spendTripId])
  const tripSpendTotal = useMemo(
    () => tripSpendRows.reduce((sum, s) => sum + Math.abs(s.amount), 0),
    [tripSpendRows],
  )

  const active = useMemo(
    () => sortBySortOrder(data.trips.filter((t) => !t.completed)),
    [data.trips],
  )
  const past = data.trips.filter((t) => t.completed)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyTrip)
    setOpen(true)
  }

  const openEdit = (t: Trip) => {
    setEditing(t)
    setForm({
      name: t.name,
      startDate: (t.startDate ?? '').slice(0, 10),
      endDate: (t.endDate ?? '').slice(0, 10),
      budget: t.budget != null ? String(t.budget) : '',
      notes: t.notes ?? '',
    })
    setOpen(true)
  }

  const save = () => {
    const trip: Trip = {
      id: editing?.id ?? nextId(data.trips),
      name: form.name.trim() || 'Trip',
      startDate: form.startDate || undefined,
      endDate: form.endDate || null,
      budget: form.budget ? parseNum(form.budget) : null,
      notes: form.notes.trim() || undefined,
      completed: editing?.completed ?? false,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      sortOrder: editing?.sortOrder,
    }
    setData((prev) => {
      const completed = prev.trips.filter((t) => t.completed)
      if (editing) {
        return {
          ...prev,
          trips: prev.trips.map((t) => (t.id === editing.id ? trip : t)),
        }
      }
      const activeTrips = prev.trips.filter((t) => !t.completed)
      return {
        ...prev,
        trips: [...applySortOrder([...activeTrips, trip]), ...completed],
      }
    })
    setOpen(false)
  }

  const settleHint =
    balance.balance > 0.005
      ? `${data.splitSettings.person2.name} owes ${data.splitSettings.person1.name} ${formatGBPPrecise(balance.balance)}`
      : balance.balance < -0.005
        ? `${data.splitSettings.person1.name} owes ${data.splitSettings.person2.name} ${formatGBPPrecise(Math.abs(balance.balance))}`
        : 'Settled up'

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Trips & splits"
        description="Track trip spend and shared expense balances. Drag active trips to reorder."
        action={
          tab === 'trips' ? (
            <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
              Add trip
            </button>
          ) : undefined
        }
      />

      <div className="flex gap-2 mb-8">
        {(['trips', 'splits'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'trips' ? 'Trips' : 'Splits'}
          </button>
        ))}
      </div>

      {tab === 'trips' && (
        <>
          <p className="label-uppercase mb-4">Active</p>
          {active.length === 0 ? (
            <div className="surface p-12 text-center text-text-subtle mb-8">
              No active trips. Add one and tag spending with a trip.
            </div>
          ) : (
            <ReorderList
              items={active}
              getId={(t) => String(t.id)}
              onReorder={(next) =>
                setData((prev) => ({
                  ...prev,
                  trips: [
                    ...applySortOrder(next),
                    ...prev.trips.filter((t) => t.completed),
                  ],
                }))
              }
              className="grid grid-cols-1 md:grid-cols-2 gap-px mb-8 trips-list-density"
            >
              {(t) => {
                const spent = tripSpend(data.spending, t.id)
                const budget = t.budget ?? 0
                const over = budget > 0 && spent > budget
                return (
                  <div className="surface p-6 sm:p-8 trips-density-card">
                    <div className="flex items-start gap-2 mb-3">
                      <ReorderHandle label={`Reorder ${t.name}`} />
                      <div className="flex-1 min-w-0 flex justify-between gap-3">
                        <h3 className="font-bold tracking-tight">{t.name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-accent shrink-0">
                          Active
                        </span>
                      </div>
                    </div>
                    <p className={`text-2xl font-bold tabular-nums mb-2 ${privacyClass(privacy)}`}>
                      {formatGBP(spent)}
                      {budget > 0 ? (
                        <span className="text-sm font-normal text-text-subtle">
                          {' '}
                          / {formatGBP(budget)}
                        </span>
                      ) : null}
                    </p>
                    {t.startDate && (
                      <p className="text-sm text-text-subtle mb-4">
                        {formatDate(t.startDate)}
                        {t.endDate ? ` → ${formatDate(t.endDate)}` : ''}
                      </p>
                    )}
                    {budget > 0 && (
                      <div className="progress-track mb-4">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, (spent / budget) * 100)}%`,
                            background: over ? 'var(--text-subtle)' : 'var(--accent)',
                          }}
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setSpendTripId(t.id)}>
                        View spend
                      </button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(t)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() =>
                          setData((prev) => ({
                            ...prev,
                            trips: prev.trips.map((x) =>
                              x.id === t.id ? { ...x, completed: true } : x,
                            ),
                          }))
                        }
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => setDeleteId(t.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              }}
            </ReorderList>
          )}

          {past.length > 0 && (
            <>
              <p className="label-uppercase mb-4">Past</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px">
                {past.map((t) => (
                  <div key={t.id} className="surface p-6 opacity-80">
                    <h3 className="font-bold tracking-tight mb-2">{t.name}</h3>
                    <p className={`text-lg font-semibold tabular-nums ${privacyClass(privacy)}`}>
                      {formatGBP(tripSpend(data.spending, t.id))}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => setSpendTripId(t.id)}
                      >
                        View spend
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() =>
                          setData((prev) => ({
                            ...prev,
                            trips: prev.trips.map((x) =>
                              x.id === t.id ? { ...x, completed: false } : x,
                            ),
                          }))
                        }
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'splits' && (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}>
            <StatCard label={data.splitSettings.person1.name + ' paid'} value={formatGBP(balance.person1Paid)} />
            <StatCard label={data.splitSettings.person2.name + ' paid'} value={formatGBP(balance.person2Paid)} />
            <StatCard label="Split txs" value={String(balance.splitCount)} hint={formatGBP(balance.totalSplit)} />
            <StatCard label="Settle" value={settleHint} />
          </div>

          <div className="surface p-6 sm:p-8 mb-px">
            <p className="eyebrow mb-4">People</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Person 1">
                <input
                  type="text"
                  value={data.splitSettings.person1.name}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      splitSettings: {
                        ...prev.splitSettings,
                        person1: { ...prev.splitSettings.person1, name: e.target.value },
                      },
                    }))
                  }
                />
              </Field>
              <Field label="Person 2">
                <input
                  type="text"
                  value={data.splitSettings.person2.name}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      splitSettings: {
                        ...prev.splitSettings,
                        person2: { ...prev.splitSettings.person2, name: e.target.value },
                      },
                    }))
                  }
                />
              </Field>
            </div>
            <p className="text-sm text-text-subtle mt-4 font-light">
              Tag spending with Paid by + Split % to update this balance.
            </p>
          </div>

          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-text-subtle">
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Description</th>
                  <th className="px-4 py-3 font-bold">Paid by</th>
                  <th className="px-4 py-3 font-bold">Split</th>
                  <th className="px-4 py-3 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.spending
                  .filter((s) => s.split && s.split !== 'no')
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((s) => (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="px-4 py-3 tabular-nums text-text-muted">{formatDate(s.date)}</td>
                      <td className="px-4 py-3">{s.description}</td>
                      <td className="px-4 py-3">
                        {s.paidBy === 'person2'
                          ? data.splitSettings.person2.name
                          : data.splitSettings.person1.name}
                      </td>
                      <td className="px-4 py-3">{s.split}%</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${privacyClass(privacy)}`}>
                        {formatGBPPrecise(s.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {balance.splitCount === 0 && (
              <p className="p-8 text-center text-text-subtle">No split expenses yet.</p>
            )}
          </div>
        </>
      )}

      <Modal open={open} title={editing ? 'Edit trip' : 'Add trip'} onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Name">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="End">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Budget £">
            <input
              type="text"
              inputMode="decimal"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={spendTripId !== null}
        title={spendTrip ? `Spend · ${spendTrip.name}` : 'Trip spend'}
        onClose={() => setSpendTripId(null)}
      >
        <p className={`text-lg font-bold tabular-nums mb-4 ${privacyClass(privacy)}`}>
          Total {formatGBP(tripSpendTotal)}
        </p>
        {tripSpendRows.length === 0 ? (
          <p className="text-sm text-text-subtle">No spending tagged to this trip.</p>
        ) : (
          <ul className="divide-y divide-border max-h-80 overflow-y-auto">
            {tripSpendRows.map((s) => (
              <li key={s.id} className="py-3 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.description}</p>
                  <p className="text-xs text-text-subtle">
                    {formatDate(s.date)} · {s.category}
                  </p>
                </div>
                <span className={`tabular-nums font-semibold shrink-0 ${privacyClass(privacy)}`}>
                  {formatGBPPrecise(s.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end mt-5">
          <button type="button" className="btn-ghost" onClick={() => setSpendTripId(null)}>
            Close
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete trip"
        body="Remove this trip? Spending trip tags will remain but no longer link."
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          setData((prev) => ({
            ...prev,
            trips: prev.trips.filter((t) => t.id !== deleteId),
          }))
        }}
      />

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary trips actions">
        <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
          Add trip
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            void syncNow().then(() => toastSuccess('Sync now finished'))
          }}
        >
          Sync now
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
