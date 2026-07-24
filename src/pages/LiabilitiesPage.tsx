import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard as CreditCardIcon, Landmark } from 'lucide-react'
import { PortfolioSeriesChart } from '../components/charts/PortfolioSeriesChart'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { usePortfolio } from '../context/PortfolioContext'
import { dailyInterestGbp, ragClass, ragLabel, type LiabilityKind } from '../domain/liabilityHelpers'
import type { CreditCard, LiabilityContactMethod, Loan, RagStatus } from '../domain/types'
import {
  loadLiabilitiesRagFilter,
  saveLiabilitiesRagFilter,
  type LiabilitiesRagFilter,
} from '../domain/liabilitiesRagPref'
import { applySortOrder, sortBySortOrder } from '../utils/reorder'
import { formatDate, formatGBP, formatPct, privacyClass } from '../utils/format'

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

type Kind = LiabilityKind
type RagFilter = LiabilitiesRagFilter

export function LiabilitiesPage() {
  const { data, breakdown, privacy, setData } = usePortfolio()
  const { liability } = breakdown

  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('card')
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [form, setForm] = useState({
    name: '',
    balance: '',
    apr: '',
    minPay: '',
    limit: '',
    original: '',
    ragStatus: '' as '' | RagStatus,
    contactPhone: '',
    contactEmail: '',
    contactUrl: '',
    preferredContactMethod: '' as '' | LiabilityContactMethod,
    preferredContactOther: '',
  })
  const [deleteTarget, setDeleteTarget] = useState<{ kind: Kind; id: number } | null>(null)
  const [ragFilter, setRagFilter] = useState<RagFilter>(() => loadLiabilitiesRagFilter())

  const openCreate = (k: Kind) => {
    setKind(k)
    setEditingCard(null)
    setEditingLoan(null)
    setForm({
      name: '',
      balance: '',
      apr: '',
      minPay: '',
      limit: '',
      original: '',
      ragStatus: '',
      contactPhone: '',
      contactEmail: '',
      contactUrl: '',
      preferredContactMethod: '',
      preferredContactOther: '',
    })
    setOpen(true)
  }

  const openEditCard = (c: CreditCard) => {
    setKind('card')
    setEditingCard(c)
    setEditingLoan(null)
    setForm({
      name: c.name,
      balance: String(c.balance),
      apr: String(c.apr),
      minPay: String(c.minPay),
      limit: String(c.limit),
      original: '',
      ragStatus: c.ragStatus ?? '',
      contactPhone: c.contactPhone ?? '',
      contactEmail: c.contactEmail ?? '',
      contactUrl: c.contactUrl ?? '',
      preferredContactMethod: c.preferredContactMethod ?? '',
      preferredContactOther: c.preferredContactOther ?? '',
    })
    setOpen(true)
  }

  const openEditLoan = (l: Loan) => {
    setKind('loan')
    setEditingLoan(l)
    setEditingCard(null)
    setForm({
      name: l.name,
      balance: String(l.balance),
      apr: String(l.apr),
      minPay: String(l.minPay),
      limit: '',
      original: String(l.original),
      ragStatus: l.ragStatus ?? '',
      contactPhone: l.contactPhone ?? '',
      contactEmail: l.contactEmail ?? '',
      contactUrl: l.contactUrl ?? '',
      preferredContactMethod: l.preferredContactMethod ?? '',
      preferredContactOther: l.preferredContactOther ?? '',
    })
    setOpen(true)
  }

  const save = () => {
    const rag = form.ragStatus || undefined
    const contactPhone = form.contactPhone.trim() || undefined
    const contactEmail = form.contactEmail.trim() || undefined
    const contactUrl = form.contactUrl.trim() || undefined
    const preferredContactMethod = form.preferredContactMethod || undefined
    const preferredContactOther =
      preferredContactMethod === 'other'
        ? form.preferredContactOther.trim() || undefined
        : undefined
    if (kind === 'card') {
      const card: CreditCard = {
        id: editingCard?.id ?? nextId(data.creditCards),
        name: form.name.trim() || 'Card',
        balance: parseNum(form.balance),
        apr: parseNum(form.apr),
        minPay: parseNum(form.minPay),
        limit: parseNum(form.limit),
        includeInPortfolio: editingCard?.includeInPortfolio ?? true,
        contactPhone,
        contactEmail,
        contactUrl,
        preferredContactMethod,
        preferredContactOther,
        commentaries: editingCard?.commentaries,
        ragStatus: rag,
        sortOrder: editingCard?.sortOrder,
      }
      setData((prev) => ({
        ...prev,
        creditCards: editingCard
          ? prev.creditCards.map((c) => (c.id === editingCard.id ? card : c))
          : [...prev.creditCards, card],
      }))
    } else {
      const loan: Loan = {
        id: editingLoan?.id ?? nextId(data.loans),
        name: form.name.trim() || 'Loan',
        balance: parseNum(form.balance),
        apr: parseNum(form.apr),
        minPay: parseNum(form.minPay),
        original: parseNum(form.original) || parseNum(form.balance),
        includeInPortfolio: editingLoan?.includeInPortfolio ?? true,
        contactPhone,
        contactEmail,
        contactUrl,
        preferredContactMethod,
        preferredContactOther,
        commentaries: editingLoan?.commentaries,
        ragStatus: rag,
        sortOrder: editingLoan?.sortOrder,
      }
      setData((prev) => ({
        ...prev,
        loans: editingLoan
          ? prev.loans.map((l) => (l.id === editingLoan.id ? loan : l))
          : [...prev.loans, loan],
      }))
    }
    setOpen(false)
  }

  const toggleCard = (id: number) => {
    setData((prev) => ({
      ...prev,
      creditCards: prev.creditCards.map((c) =>
        c.id === id ? { ...c, includeInPortfolio: c.includeInPortfolio === false } : c,
      ),
    }))
  }

  const toggleLoan = (id: number) => {
    setData((prev) => ({
      ...prev,
      loans: prev.loans.map((l) =>
        l.id === id ? { ...l, includeInPortfolio: l.includeInPortfolio === false } : l,
      ),
    }))
  }

  const matchesRag = (status: RagStatus | undefined) => {
    if (ragFilter === 'all') return true
    if (ragFilter === 'unset') return !status
    return status === ragFilter
  }

  const cards = useMemo(
    () =>
      sortBySortOrder(
        data.creditCards.filter((c) => matchesRag(c.ragStatus)),
        (a, b) => b.apr - a.apr,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.creditCards, ragFilter],
  )

  const loans = useMemo(
    () =>
      sortBySortOrder(
        data.loans.filter((l) => matchesRag(l.ragStatus)),
        (a, b) => b.apr - a.apr,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.loans, ragFilter],
  )

  const canDrag = ragFilter === 'all'

  const reorderCards = (next: CreditCard[]) => {
    setData((prev) => ({ ...prev, creditCards: applySortOrder(next) }))
  }

  const reorderLoans = (next: Loan[]) => {
    setData((prev) => ({ ...prev, loans: applySortOrder(next) }))
  }

  const ragCounts = useMemo(() => {
    const all = [...data.creditCards, ...data.loans]
    return {
      red: all.filter((i) => i.ragStatus === 'red').length,
      amber: all.filter((i) => i.ragStatus === 'amber').length,
      green: all.filter((i) => i.ragStatus === 'green').length,
      unset: all.filter((i) => !i.ragStatus).length,
    }
  }, [data.creditCards, data.loans])

  const dailyBurn = useMemo(() => {
    return [...data.creditCards, ...data.loans]
      .filter((i) => i.includeInPortfolio !== false)
      .reduce((s, i) => s + dailyInterestGbp(i.balance, i.apr), 0)
  }, [data.creditCards, data.loans])

  return (
    <div>
      <PageHeader
        eyebrow="Debt"
        title="Liabilities"
        description="Open any item for commentary and pay-down. Drag ⋮⋮ to pin critical debts to the top (saved with your portfolio)."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/optimizer" className="btn-ghost btn-sm">
              Debt tools
            </Link>
            <button type="button" className="btn-secondary btn-sm" onClick={() => openCreate('card')}>
              Add card
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={() => openCreate('loan')}>
              Add loan
            </button>
          </div>
        }
      />

      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px mb-6 ${privacyClass(privacy)}`}>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Total debt</p>
          <p className="text-2xl font-bold tabular-nums">{formatGBP(liability.total)}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Credit cards</p>
          <p className="text-2xl font-bold tabular-nums">{formatGBP(liability.cc)}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Min payments / mo</p>
          <p className="text-2xl font-bold tabular-nums text-accent">{formatGBP(liability.monthly)}</p>
        </div>
        <div className="surface p-6">
          <p className="label-uppercase mb-2">Interest / day</p>
          <p className="text-2xl font-bold tabular-nums">{formatGBP(dailyBurn)}</p>
        </div>
      </div>

      <div className="mb-6">
        <PortfolioSeriesChart
          history={data.history}
          privacy={privacy}
          title="Debt over time"
          eyebrow="Chart"
          primary="liabilities"
          invertDelta
          defaultRange="12M"
          heightClass="h-56 sm:h-64 lg:h-72"
        />
      </div>

      <div
        className="liabilities-sticky-rag flex flex-wrap gap-2 mb-8"
        data-testid="liabilities-sticky-rag"
        role="group"
        aria-label="Filter liabilities by RAG"
      >
        {(
          [
            ['all', 'All'],
            ['red', `Red (${ragCounts.red})`],
            ['amber', `Amber (${ragCounts.amber})`],
            ['green', `Green (${ragCounts.green})`],
            ['unset', `Unset (${ragCounts.unset})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn-ghost btn-sm ${ragFilter === key ? 'border-accent text-accent' : ''}`}
            onClick={() => {
              setRagFilter(key)
              saveLiabilitiesRagFilter(key)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <h3 className="eyebrow mb-2">Credit cards</h3>
      <p className="text-xs text-text-subtle mb-4">
        {canDrag
          ? 'Drag the grip to reorder — order is saved with this portfolio.'
          : 'Clear the RAG filter to drag-reorder cards.'}
      </p>
      {cards.length === 0 ? (
        data.creditCards.length === 0 ? (
          <div className="mb-10">
            <EmptyState
              icon={<CreditCardIcon size={40} strokeWidth={1.25} />}
              title="No credit cards yet"
              description="Track balances, utilisation, and RAG status for each card."
              action={{ label: 'Add card', onClick: () => openCreate('card') }}
            />
          </div>
        ) : (
          <div className="surface p-8 text-text-subtle mb-10">No cards match this RAG filter.</div>
        )
      ) : (
        <ReorderList
          items={cards}
          getId={(c) => `card-${c.id}`}
          onReorder={canDrag ? reorderCards : () => undefined}
          className="grid grid-cols-1 md:grid-cols-2 gap-px mb-10"
        >
          {(c) => {
            const included = c.includeInPortfolio !== false
            const util = c.limit > 0 ? (c.balance / c.limit) * 100 : 0
            const notes = c.commentaries?.length ?? 0
            return (
              <div className={`surface surface-interactive p-5 sm:p-8 h-full ${included ? '' : 'opacity-50'}`}>
                <div className="flex justify-between gap-3 mb-3">
                  <div className="flex gap-2 min-w-0 flex-1">
                    {canDrag && <ReorderHandle label={`Reorder ${c.name}`} />}
                    <Link to={`/liabilities/card/${c.id}`} className="min-w-0 flex-1 group">
                      <h4 className="font-bold tracking-tight group-hover:text-accent text-left">
                        {c.name}
                      </h4>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={ragClass(c.ragStatus)}>{ragLabel(c.ragStatus)}</span>
                        <span className="text-[11px] uppercase tracking-widest text-accent">
                          {notes > 0 ? `${notes} note${notes === 1 ? '' : 's'}` : 'Add commentary →'}
                        </span>
                      </div>
                    </Link>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 shrink-0">
                    <Link to={`/liabilities/card/${c.id}`} className="btn-primary btn-sm text-center">
                      Open
                    </Link>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => openEditCard(c)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setDeleteTarget({ kind: 'card', id: c.id })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <Link to={`/liabilities/card/${c.id}`} className="block">
                  <p className={`text-2xl font-bold tabular-nums mb-3 ${privacyClass(privacy)}`}>
                    {formatGBP(c.balance)}
                  </p>
                  <p className="text-sm text-text-subtle font-light mb-3">
                    APR {c.apr.toFixed(2)}% · Min {formatGBP(c.minPay)} · Util{' '}
                    {formatPct(util, 0).replace('+', '')}
                  </p>
                  <div className="progress-track mb-4">
                    <div className="progress-fill" style={{ width: `${Math.min(util, 100)}%` }} />
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleCard(c.id)}
                  className="text-[11px] font-bold uppercase tracking-widest text-accent"
                >
                  {included ? 'Included in NW' : 'Excluded from NW'}
                </button>
              </div>
            )
          }}
        </ReorderList>
      )}

      <h3 className="eyebrow mb-2">Loans</h3>
      <p className="text-xs text-text-subtle mb-4">
        {canDrag
          ? 'Drag the grip to reorder — order is saved with this portfolio.'
          : 'Clear the RAG filter to drag-reorder loans.'}
      </p>
      {loans.length === 0 ? (
        data.loans.length === 0 ? (
          <div className="mb-10">
            <EmptyState
              icon={<Landmark size={40} strokeWidth={1.25} />}
              title="No loans yet"
              description="Add mortgages, car loans, or personal debt with original balance and progress."
              action={{ label: 'Add loan', onClick: () => openCreate('loan') }}
            />
          </div>
        ) : (
          <div className="surface p-8 text-text-subtle mb-10">No loans match this RAG filter.</div>
        )
      ) : (
        <ReorderList
          items={loans}
          getId={(l) => `loan-${l.id}`}
          onReorder={canDrag ? reorderLoans : () => undefined}
          className="grid grid-cols-1 md:grid-cols-2 gap-px mb-10"
        >
          {(l) => {
            const included = l.includeInPortfolio !== false
            const paid = l.original > 0 ? ((l.original - l.balance) / l.original) * 100 : 0
            const notes = l.commentaries?.length ?? 0
            return (
              <div className={`surface surface-interactive p-5 sm:p-8 h-full ${included ? '' : 'opacity-50'}`}>
                <div className="flex justify-between gap-3 mb-3">
                  <div className="flex gap-2 min-w-0 flex-1">
                    {canDrag && <ReorderHandle label={`Reorder ${l.name}`} />}
                    <Link to={`/liabilities/loan/${l.id}`} className="min-w-0 flex-1 group">
                      <h4 className="font-bold tracking-tight group-hover:text-accent text-left">
                        {l.name}
                      </h4>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={ragClass(l.ragStatus)}>{ragLabel(l.ragStatus)}</span>
                        <span className="text-[11px] uppercase tracking-widest text-accent">
                          {notes > 0 ? `${notes} note${notes === 1 ? '' : 's'}` : 'Add commentary →'}
                        </span>
                      </div>
                    </Link>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 shrink-0">
                    <Link to={`/liabilities/loan/${l.id}`} className="btn-primary btn-sm text-center">
                      Open
                    </Link>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => openEditLoan(l)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setDeleteTarget({ kind: 'loan', id: l.id })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <Link to={`/liabilities/loan/${l.id}`} className="block">
                  <p className={`text-2xl font-bold tabular-nums mb-3 ${privacyClass(privacy)}`}>
                    {formatGBP(l.balance)}
                  </p>
                  <p className="text-sm text-text-subtle font-light mb-3">
                    APR {l.apr.toFixed(2)}% · Min {formatGBP(l.minPay)} · Original{' '}
                    {formatGBP(l.original)}
                  </p>
                  <div className="progress-track mb-4">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(Math.max(paid, 0), 100)}%` }}
                    />
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleLoan(l.id)}
                  className="text-[11px] font-bold uppercase tracking-widest text-accent"
                >
                  {included ? 'Included in NW' : 'Excluded from NW'}
                </button>
              </div>
            )
          }}
        </ReorderList>
      )}

      {data.paidOff.length > 0 && (
        <>
          <h3 className="eyebrow mb-4">Paid off</h3>
          <div className="surface divide-y divide-border">
            {data.paidOff.map((p) => (
              <div key={`${p.name}-${p.paidDate}`} className="px-6 py-4 flex justify-between gap-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-text-subtle mt-1">{formatDate(p.paidDate)}</p>
                </div>
                <p className={`font-semibold tabular-nums ${privacyClass(privacy)}`}>
                  {formatGBP(p.original)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={open}
        size="full"
        title={
          kind === 'card'
            ? editingCard
              ? 'Edit credit card'
              : 'Add credit card'
            : editingLoan
              ? 'Edit loan'
              : 'Add loan'
        }
        onClose={() => setOpen(false)}
      >
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Balance (GBP)">
              <input
                type="text"
                inputMode="decimal"
                required
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </Field>
            <Field label="APR %">
              <input
                type="text"
                inputMode="decimal"
                value={form.apr}
                onChange={(e) => setForm({ ...form, apr: e.target.value })}
              />
            </Field>
            <Field label="Min payment (GBP)">
              <input
                type="text"
                inputMode="decimal"
                value={form.minPay}
                onChange={(e) => setForm({ ...form, minPay: e.target.value })}
              />
            </Field>
            {kind === 'card' ? (
              <Field label="Limit (GBP)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="Original amount (GBP)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.original}
                  onChange={(e) => setForm({ ...form, original: e.target.value })}
                />
              </Field>
            )}
          </div>
          <Field label="RAG status">
            <select
              value={form.ragStatus}
              onChange={(e) =>
                setForm({ ...form, ragStatus: e.target.value as '' | RagStatus })
              }
            >
              <option value="">Unset</option>
              <option value="red">Red — critical</option>
              <option value="amber">Amber — watch</option>
              <option value="green">Green — on track</option>
            </select>
          </Field>
          <div>
            <h3 className="font-bold mb-3">Lender contacts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Phone">
                <input
                  type="tel"
                  autoComplete="tel"
                  data-testid="liability-form-contact-phone"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="+44…"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  autoComplete="email"
                  data-testid="liability-form-contact-email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="collections@lender.com"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="URL">
                  <input
                    type="url"
                    data-testid="liability-form-contact-url"
                    value={form.contactUrl}
                    onChange={(e) => setForm({ ...form, contactUrl: e.target.value })}
                    placeholder="https://"
                  />
                </Field>
              </div>
              <Field label="Preferred method of contact">
                <select
                  data-testid="liability-form-contact-preferred"
                  value={form.preferredContactMethod}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      preferredContactMethod: e.target.value as '' | LiabilityContactMethod,
                    })
                  }
                >
                  <option value="">Not set</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="web">Web</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              {form.preferredContactMethod === 'other' ? (
                <Field label="Other — details">
                  <input
                    type="text"
                    data-testid="liability-form-contact-preferred-other"
                    value={form.preferredContactOther}
                    onChange={(e) =>
                      setForm({ ...form, preferredContactOther: e.target.value })
                    }
                    placeholder="e.g. In-app chat, WhatsApp…"
                  />
                </Field>
              ) : (
                <div className="hidden md:block" aria-hidden />
              )}
            </div>
          </div>
          {(editingCard || editingLoan) && (
            <p className="text-sm text-text-muted font-light leading-relaxed border border-border p-4">
              Call notes and progress commentary live on the full debt workspace — tap{' '}
              <strong className="text-accent font-semibold">Open</strong> on the card, or{' '}
              <Link
                className="text-accent font-semibold underline-offset-2 hover:underline"
                to={
                  kind === 'card'
                    ? `/liabilities/card/${editingCard!.id}`
                    : `/liabilities/loan/${editingLoan!.id}`
                }
                onClick={() => setOpen(false)}
              >
                open {kind === 'card' ? editingCard!.name : editingLoan!.name}
              </Link>
              .
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
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
        open={deleteTarget !== null}
        title="Delete liability"
        body="Remove this debt from the portfolio?"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          if (deleteTarget.kind === 'card') {
            setData((prev) => ({
              ...prev,
              creditCards: prev.creditCards.filter((c) => c.id !== deleteTarget.id),
            }))
          } else {
            setData((prev) => ({
              ...prev,
              loans: prev.loans.filter((l) => l.id !== deleteTarget.id),
            }))
          }
        }}
      />

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary liabilities actions">
        <button type="button" className="btn-secondary btn-sm" onClick={() => openCreate('card')}>
          Add card
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={() => openCreate('loan')}>
          Add loan
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
