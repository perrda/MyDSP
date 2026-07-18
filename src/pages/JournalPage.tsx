import { useMemo, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { usePortfolio } from '../context/PortfolioContext'
import {
  applyTrade,
  deleteJournalTrade,
  isTradeType,
  upsertJournalTrade,
} from '../domain/trades'
import type { JournalEntry } from '../domain/types'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { formatDate, formatGBP, formatGBPPrecise, formatQty, privacyClass } from '../utils/format'

const TYPES = ['buy', 'sell', 'staking', 'transfer'] as const

const ROW_GRID =
  'grid grid-cols-[auto_minmax(5rem,1fr)_minmax(4rem,1fr)_minmax(4rem,1fr)_minmax(4rem,1fr)_minmax(5rem,1fr)_minmax(4rem,1fr)_minmax(5rem,1fr)_auto] gap-x-3 items-center'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

const empty = {
  date: new Date().toISOString().slice(0, 10),
  type: 'buy',
  asset: '',
  qty: '',
  price: '',
  fees: '0',
  notes: '',
  platform: '',
}

function JournalRowBody({
  j,
  privacy,
  draggable,
  onEdit,
  onDelete,
}: {
  j: JournalEntry
  privacy: boolean
  draggable: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <>
      {draggable ? <ReorderHandle label={`Reorder ${j.asset} ${j.date}`} /> : <span className="w-8" aria-hidden />}
      <span className="text-sm text-text-muted">{formatDate(j.date)}</span>
      <span>
        <span className="bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">
          {j.type}
        </span>
      </span>
      <span className="font-semibold">{j.asset}</span>
      <span className="text-sm tabular-nums">{formatQty(j.qty)}</span>
      <span className={`text-sm tabular-nums ${privacyClass(privacy)}`}>{formatGBPPrecise(j.price)}</span>
      <span className={`text-sm tabular-nums ${privacyClass(privacy)}`}>{formatGBPPrecise(j.fees)}</span>
      <span className={`text-sm font-semibold tabular-nums ${privacyClass(privacy)}`}>{formatGBP(j.total)}</span>
      <div className="whitespace-nowrap text-right">
        <button type="button" className="btn-ghost btn-sm" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onDelete}>
          Delete
        </button>
      </div>
    </>
  )
}

export function JournalPage() {
  const { data, setData, privacy } = usePortfolio()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<JournalEntry | null>(null)
  const [form, setForm] = useState(empty)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [filter, setFilter] = useState('All')
  const [applyHolding, setApplyHolding] = useState(true)
  const [inferKind, setInferKind] = useState<'crypto' | 'equity'>('equity')

  const holdingSymbols = useMemo(() => {
    const set = new Set<string>()
    for (const c of data.crypto) set.add(c.symbol.toUpperCase())
    for (const e of data.equities) set.add(e.symbol.toUpperCase())
    return [...set].sort()
  }, [data.crypto, data.equities])

  const assets = useMemo(
    () => ['All', ...Array.from(new Set([...holdingSymbols, ...data.journal.map((j) => j.asset)])).sort()],
    [data.journal, holdingSymbols],
  )

  const sortedJournal = useMemo(
    () => sortBySortOrder(data.journal, (a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [data.journal],
  )

  const rows = useMemo(() => {
    return sortedJournal.filter((j) => filter === 'All' || j.asset === filter)
  }, [sortedJournal, filter])

  const canDrag = filter === 'All'

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  const openEdit = (j: JournalEntry) => {
    setEditing(j)
    setForm({
      date: j.date.slice(0, 10),
      type: j.type,
      asset: j.asset,
      qty: String(j.qty),
      price: String(j.price),
      fees: String(j.fees),
      notes: j.notes ?? '',
      platform: j.platform ?? '',
    })
    setOpen(true)
  }

  const save = () => {
    const qty = parseNum(form.qty)
    const price = parseNum(form.price)
    const fees = parseNum(form.fees)
    const asset = form.asset.trim().toUpperCase() || '???'
    const type = form.type
    const notional = qty * price
    const total = type === 'sell' ? Math.max(0, notional - fees) : notional + fees

    const resolveKind = (): 'crypto' | 'equity' => {
      if (data.crypto.some((c) => c.symbol.toUpperCase() === asset)) return 'crypto'
      if (data.equities.some((e) => e.symbol.toUpperCase() === asset)) return 'equity'
      return inferKind
    }

    if (isTradeType(type) && applyHolding) {
      const kind = resolveKind()
      if (editing) {
        setData((prev) =>
          upsertJournalTrade(
            prev,
            {
              ...editing,
              date: form.date,
              type,
              asset,
              qty,
              price,
              fees,
              total,
              notes: form.notes.trim() || undefined,
              platform: form.platform.trim() || undefined,
            },
            kind,
          ),
        )
      } else {
        setData((prev) =>
          applyTrade(prev, {
            kind,
            side: type,
            symbol: asset,
            date: form.date,
            qty,
            price,
            fees,
            notes: form.notes.trim() || undefined,
            platform: form.platform.trim() || undefined,
          }),
        )
      }
      setOpen(false)
      return
    }

    const entry: JournalEntry = {
      id: editing?.id ?? nextId(data.journal),
      date: form.date,
      type,
      asset,
      qty,
      price,
      fees,
      total,
      notes: form.notes.trim() || undefined,
      platform: form.platform.trim() || undefined,
      sortOrder: editing?.sortOrder,
    }
    setData((prev) => ({
      ...prev,
      journal: editing
        ? prev.journal.map((j) => (j.id === editing.id ? entry : j))
        : applySortOrder([...prev.journal, entry]),
    }))
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Investment journal"
        description="Buy, sell, staking, and transfer ledger — drag ⋮⋮ to reorder when showing all assets."
        action={
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            Add entry
          </button>
        }
      />

      <div className="surface p-5 mb-px">
        <label className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2">
          Asset filter
        </label>
        <select className="sm:w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {assets.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="surface overflow-x-auto">
        <div className="min-w-[800px]">
          <div
            className={`${ROW_GRID} border-b border-border px-5 py-4 text-[10px] uppercase tracking-widest text-text-subtle`}
          >
            <span className="w-8" aria-hidden />
            <span className="label-uppercase">Date</span>
            <span className="label-uppercase">Type</span>
            <span className="label-uppercase">Asset</span>
            <span className="label-uppercase">Qty</span>
            <span className="label-uppercase">Price</span>
            <span className="label-uppercase">Fees</span>
            <span className="label-uppercase">Total</span>
            <span className="w-28" />
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-text-subtle">No journal entries yet.</p>
          ) : canDrag ? (
            <ReorderList
              items={rows}
              getId={(j) => String(j.id)}
              onReorder={(next) => setData((prev) => ({ ...prev, journal: applySortOrder(next) }))}
            >
              {(j) => (
                <div className={`${ROW_GRID} border-b border-border/60 px-5 py-3 text-sm last:border-0`}>
                  <JournalRowBody
                    j={j}
                    privacy={privacy}
                    draggable
                    onEdit={() => openEdit(j)}
                    onDelete={() => setDeleteId(j.id)}
                  />
                </div>
              )}
            </ReorderList>
          ) : (
            rows.map((j) => (
              <div key={j.id} className={`${ROW_GRID} border-b border-border/60 px-5 py-3 text-sm last:border-0`}>
                <JournalRowBody
                  j={j}
                  privacy={privacy}
                  draggable={false}
                  onEdit={() => openEdit(j)}
                  onDelete={() => setDeleteId(j.id)}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={open} title={editing ? 'Edit journal entry' : 'Add journal entry'} onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Notes">
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional context for this trade"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Asset">
            <input
              type="text"
              list="journal-assets"
              required
              value={form.asset}
              onChange={(e) => setForm({ ...form, asset: e.target.value })}
              placeholder="BTC / TSLA"
            />
            <datalist id="journal-assets">
              {holdingSymbols.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          {(form.type === 'buy' || form.type === 'sell') && (
            <div className="space-y-3 border border-border p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={applyHolding}
                  onChange={(e) => setApplyHolding(e.target.checked)}
                />
                Rebuild holding qty &amp; cost from journal after save
              </label>
              {applyHolding &&
                !data.crypto.some((c) => c.symbol.toUpperCase() === form.asset.trim().toUpperCase()) &&
                !data.equities.some(
                  (e) => e.symbol.toUpperCase() === form.asset.trim().toUpperCase(),
                ) && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`btn-sm ${inferKind === 'crypto' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setInferKind('crypto')}
                    >
                      New crypto
                    </button>
                    <button
                      type="button"
                      className={`btn-sm ${inferKind === 'equity' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setInferKind('equity')}
                    >
                      New equity
                    </button>
                  </div>
                )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Qty">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
              />
            </Field>
            <Field label="Price £">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label="Fees £">
              <input
                type="text"
                inputMode="decimal"
                value={form.fees}
                onChange={(e) => setForm({ ...form, fees: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Platform">
            <input
              type="text"
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
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

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete journal entry"
        body="Remove this investment journal entry? Buy/sell deletions recalculate the holding cost basis."
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          const entry = data.journal.find((j) => j.id === deleteId)
          setData((prev) => {
            if (entry && isTradeType(entry.type)) {
              const kind = prev.crypto.some(
                (c) => c.symbol.toUpperCase() === entry.asset.toUpperCase(),
              )
                ? 'crypto'
                : 'equity'
              return deleteJournalTrade(prev, deleteId, kind, entry.asset)
            }
            return { ...prev, journal: prev.journal.filter((j) => j.id !== deleteId) }
          })
          setDeleteId(null)
        }}
      />

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary journal actions">
        <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
          Add entry
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
