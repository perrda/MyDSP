import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { PagePrimaryActions } from '../components/ui/PagePrimaryActions'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import { spendingHighlightUrl } from '../domain/deepLinks'
import { appendSpendingEntry } from '../domain/recurringActions'
import { calcStakingSummary, currentEpoch, epochApy } from '../domain/staking'
import type { StakingReward } from '../domain/types'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { formatDate, formatGBP, formatQty, privacyClass } from '../utils/format'

const emptyReward = {
  epoch: String(currentEpoch()),
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  stake: '',
  priceAtTime: '',
  notes: '',
}

function rewardKey(r: StakingReward): string {
  return `${r.epoch}|${r.date}|${r.amount}|${r.addedAt ?? ''}`
}

export function StakingPage() {
  const { data, setData, privacy } = usePortfolio()
  const { showToast } = useToasts()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [form, setForm] = useState(emptyReward)
  const [alsoLogCashIncome, setAlsoLogCashIncome] = useState(false)
  const [deleteKey, setDeleteKey] = useState<string | null>(null)
  const [csvMsg, setCsvMsg] = useState<string | null>(null)

  const summary = useMemo(
    () => calcStakingSummary(data.staking, data.crypto),
    [data.staking, data.crypto],
  )

  const rewards = useMemo(
    () =>
      sortBySortOrder(data.staking.rewards, (a, b) => {
        const byDate = b.date.localeCompare(a.date)
        return byDate !== 0 ? byDate : b.epoch - a.epoch
      }),
    [data.staking.rewards],
  )

  const importCsv = async (file: File) => {
    const text = await file.text()
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) {
      setCsvMsg('CSV needs a header and at least one row.')
      return
    }
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ''))
    const idx = (name: string) => headers.findIndex((h) => h.includes(name))
    const epochI = idx('epoch')
    const amountI = idx('amount')
    const dateI = idx('date')
    const stakeI = idx('stake')
    const priceI = idx('priceattime')
    if (epochI < 0 || amountI < 0 || dateI < 0) {
      setCsvMsg('CSV needs headers: epoch, amount, date (optional: stake, priceAtTime).')
      return
    }
    const imported: StakingReward[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const epoch = Number(cols[epochI])
      const amount = Number(cols[amountI])
      const date = cols[dateI]
      if (!Number.isFinite(epoch) || !Number.isFinite(amount) || !date) continue
      imported.push({
        epoch,
        amount,
        date: date.slice(0, 10),
        stake: stakeI >= 0 && cols[stakeI] ? Number(cols[stakeI]) : undefined,
        priceAtTime: priceI >= 0 && cols[priceI] ? Number(cols[priceI]) : undefined,
        pool: data.staking.pool.name,
        addedAt: new Date().toISOString(),
      })
    }
    if (!imported.length) {
      setCsvMsg('No valid reward rows found.')
      return
    }
    setData((prev) => ({
      ...prev,
      staking: {
        ...prev.staking,
        rewards: applySortOrder([...prev.staking.rewards, ...imported]),
      },
    }))
    setCsvMsg(`Imported ${imported.length} staking rewards.`)
  }

  const openCreate = () => {
    setEditingKey(null)
    setAlsoLogCashIncome(false)
    setForm({
      ...emptyReward,
      epoch: String(currentEpoch()),
      stake: summary.stakeAda ? String(summary.stakeAda) : '',
      priceAtTime: (() => {
        const ada = data.crypto.find((c) => c.symbol === 'ADA')
        return ada ? String(ada.price) : ''
      })(),
    })
    setOpen(true)
  }

  const openEdit = (r: StakingReward) => {
    setEditingKey(rewardKey(r))
    setAlsoLogCashIncome(false)
    setForm({
      epoch: String(r.epoch),
      amount: String(r.amount),
      date: r.date.slice(0, 10),
      stake: r.stake != null ? String(r.stake) : '',
      priceAtTime: r.priceAtTime != null ? String(r.priceAtTime) : '',
      notes: r.notes ?? '',
    })
    setOpen(true)
  }

  const save = () => {
    const existing =
      editingKey != null
        ? data.staking.rewards.find((r) => rewardKey(r) === editingKey)
        : undefined
    const reward: StakingReward = {
      epoch: parseNum(form.epoch),
      amount: parseNum(form.amount),
      date: form.date,
      stake: form.stake ? parseNum(form.stake) : undefined,
      priceAtTime: form.priceAtTime ? parseNum(form.priceAtTime) : undefined,
      notes: form.notes.trim() || undefined,
      pool: data.staking.pool.name,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      sortOrder: existing?.sortOrder,
    }
    const rewards = [...data.staking.rewards]
    if (editingKey !== null) {
      const idx = rewards.findIndex((r) => rewardKey(r) === editingKey)
      if (idx >= 0) rewards[idx] = reward
    } else {
      rewards.push(reward)
    }
    let nextData = {
      ...data,
      staking: {
        ...data.staking,
        rewards: editingKey !== null ? rewards : applySortOrder(rewards),
      },
    }
    let cashSpendId: number | null = null
    if (editingKey === null && alsoLogCashIncome) {
      const priceAtTime = parseNum(form.priceAtTime)
      if (!(reward.amount > 0) || !(priceAtTime > 0)) return
      const asset = data.staking.pool.ticker?.trim() || 'ADA'
      const appended = appendSpendingEntry(nextData, {
        date: reward.date.slice(0, 10),
        description: `${asset} staking reward`,
        amount: reward.amount * priceAtTime,
        category: 'income',
        method: 'credit',
      })
      nextData = appended.data
      cashSpendId = appended.spendId
    }
    setData(nextData)
    setOpen(false)
    if (cashSpendId != null) {
      const spendId = cashSpendId
      showToast({
        type: 'success',
        title: 'Reward and cash income logged',
        message: 'Added to the cash ledger only; this does not perform a tax calculation.',
        action: {
          label: 'View in Spending',
          onClick: () => navigate(spendingHighlightUrl(spendId, { category: 'income' })),
        },
      })
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Crypto"
        title="Staking rewards"
        description="A separate manual rewards ledger for ADA (or other assets) and estimated APY."
        action={
          <PagePrimaryActions
            primaryLabel="Add reward"
            onPrimary={openCreate}
            menuLabel="Staking actions"
          />
        }
      />

      <div
        className="surface border-l-2 border-l-accent px-5 py-4 mb-6"
        data-testid="staking-manual-ledger-note"
      >
        <p className="text-sm font-semibold">Manual ledger — no automatic accounting</p>
        <p className="text-xs text-text-subtle mt-1">
          Rewards and APY entered here do not change crypto holding quantity or cost basis, add
          trade-journal rows, or book P&amp;L. Record any holding or tax changes separately.
        </p>
      </div>

      {csvMsg && (
        <div className="surface border-l-2 border-l-accent px-5 py-4 mb-6" role="status">
          <p className="text-sm">{csvMsg}</p>
        </div>
      )}

      <div className="surface p-6 sm:p-8 mb-px">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mb-6">
          <Field label="Pool name">
            <input
              type="text"
              value={data.staking.pool.name}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  staking: {
                    ...prev.staking,
                    pool: { ...prev.staking.pool, name: e.target.value },
                  },
                }))
              }
            />
          </Field>
          <Field label="Ticker">
            <input
              type="text"
              value={data.staking.pool.ticker ?? ''}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  staking: {
                    ...prev.staking,
                    pool: { ...prev.staking.pool, ticker: e.target.value },
                  },
                }))
              }
            />
          </Field>
        </div>
        <p className="eyebrow mb-2">Import CSV</p>
        <p className="text-sm text-text-subtle mb-3 font-light">
          Headers: epoch, amount, date, stake, priceAtTime
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importCsv(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}>
        <StatCard label="Total rewards" value={`${formatQty(summary.totalAda)} ADA`} hint={formatGBP(summary.totalGbp)} />
        <StatCard label="Est. APY" value={`${summary.estimatedApy.toFixed(1)}%`} hint={`${formatQty(summary.avgMonthlyAda)} ADA / mo`} />
        <StatCard label="Stake" value={`${formatQty(summary.stakeAda)} ADA`} />
        <StatCard label="Current epoch" value={String(summary.currentEpoch)} hint={`${summary.rewardCount} logged`} />
      </div>

      <div className="surface overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[auto_minmax(4rem,1fr)_minmax(6rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_auto] gap-x-4 border-b border-border px-4 py-3 text-left text-[10px] uppercase tracking-widest text-text-subtle">
            <span className="w-8" aria-hidden />
            <span className="font-bold">Epoch</span>
            <span className="font-bold">Date</span>
            <span className="font-bold text-right">ADA</span>
            <span className="font-bold text-right">GBP</span>
            <span className="font-bold text-right">Epoch APY</span>
            <span className="font-bold w-28" />
          </div>
          {rewards.length === 0 ? (
            <p className="p-10 text-center text-text-subtle">No rewards logged yet.</p>
          ) : (
            <ReorderList
              items={rewards}
              getId={rewardKey}
              onReorder={(next) =>
                setData((prev) => ({
                  ...prev,
                  staking: { ...prev.staking, rewards: applySortOrder(next) },
                }))
              }
            >
              {(r) => {
                const px =
                  r.priceAtTime && r.priceAtTime > 0
                    ? r.priceAtTime
                    : data.crypto.find((c) => c.symbol === 'ADA')?.price ?? 0
                const apy = epochApy(r)
                return (
                  <div className="grid grid-cols-[auto_minmax(4rem,1fr)_minmax(6rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_auto] gap-x-4 items-center border-b border-border/60 px-4 py-3 text-sm">
                    <ReorderHandle label={`Reorder epoch ${r.epoch}`} />
                    <span className="font-semibold tabular-nums">{r.epoch}</span>
                    <span className="text-text-muted">{formatDate(r.date)}</span>
                    <span className={`text-right tabular-nums ${privacyClass(privacy)}`}>
                      {formatQty(r.amount)}
                    </span>
                    <span className={`text-right tabular-nums ${privacyClass(privacy)}`}>
                      {formatGBP(r.amount * px)}
                    </span>
                    <span className="text-right tabular-nums text-text-subtle">
                      {apy != null ? `${apy.toFixed(1)}%` : '—'}
                    </span>
                    <div className="whitespace-nowrap w-28 text-right">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setDeleteKey(rewardKey(r))}>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              }}
            </ReorderList>
          )}
        </div>
      </div>

      <Modal open={open} title={editingKey !== null ? 'Edit reward' : 'Add reward'} onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Epoch">
              <input
                type="text"
                inputMode="numeric"
                required
                value={form.epoch}
                onChange={(e) => setForm({ ...form, epoch: e.target.value })}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount (ADA)">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Stake (ADA)">
              <input
                type="text"
                inputMode="decimal"
                value={form.stake}
                onChange={(e) => setForm({ ...form, stake: e.target.value })}
              />
            </Field>
          </div>
          <Field label="ADA price at time (GBP)">
            <input
              type="text"
              inputMode="decimal"
              required={editingKey === null && alsoLogCashIncome}
              value={form.priceAtTime}
              onChange={(e) => setForm({ ...form, priceAtTime: e.target.value })}
            />
          </Field>
          {editingKey === null ? (
            <label className="flex items-start gap-3 surface-nested p-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={alsoLogCashIncome}
                onChange={(e) => setAlsoLogCashIncome(e.target.checked)}
              />
              <span>
                <span className="text-sm font-medium">Also log cash income</span>
                <span className="block text-xs text-text-muted font-light mt-0.5">
                  Adds amount × price at time to Spending as income. Cash ledger only — this does
                  not calculate taxable income or update tax records.
                </span>
              </span>
            </label>
          ) : null}
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

      <ConfirmDialog
        open={deleteKey !== null}
        title="Delete reward"
        body="Remove this staking reward entry?"
        onClose={() => setDeleteKey(null)}
        onConfirm={() => {
          if (deleteKey === null) return
          setData((prev) => ({
            ...prev,
            staking: {
              ...prev.staking,
              rewards: prev.staking.rewards.filter((r) => rewardKey(r) !== deleteKey),
            },
          }))
        }}
      />
    </div>
  )
}
