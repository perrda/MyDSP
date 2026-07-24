import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExternalLink, Mail, Pencil, Phone, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { BackNav } from '../components/ui/BackNav'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { useToasts } from '../components/ToastProvider'
import { usePortfolio } from '../context/PortfolioContext'
import {
  dailyInterestGbp,
  monthlyInterestGbp,
  nextCommentaryId,
  portfolioDebtAfter,
  ragClass,
  ragLabel,
  simulateSingleDebt,
  suggestRag,
  type LiabilityKind,
} from '../domain/liabilityHelpers'
import type { CreditCard, LiabilityCommentary, Loan, RagStatus } from '../domain/types'
import { formatDateTime, formatGBP, formatPct, privacyClass } from '../utils/format'

function asKind(raw: string | undefined): LiabilityKind | null {
  if (raw === 'card' || raw === 'loan') return raw
  return null
}

export function LiabilityDetailPage() {
  const { kind: kindParam, id: idParam } = useParams()
  const kind = asKind(kindParam)
  const id = Number(idParam)
  const navigate = useNavigate()
  const { data, breakdown, privacy, setData } = usePortfolio()
  const { success } = useToasts()

  const item: CreditCard | Loan | null = useMemo(() => {
    if (!kind || !Number.isFinite(id)) return null
    if (kind === 'card') return data.creditCards.find((c) => c.id === id) ?? null
    return data.loans.find((l) => l.id === id) ?? null
  }, [data.creditCards, data.loans, kind, id])

  const [contactForm, setContactForm] = useState({ phone: '', email: '', url: '' })
  const [contactEditing, setContactEditing] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [editingNote, setEditingNote] = useState<LiabilityCommentary | null>(null)
  const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null)
  const [clearContactsConfirm, setClearContactsConfirm] = useState(false)
  const [extraPay, setExtraPay] = useState('200')
  const [lumpSum, setLumpSum] = useState('')
  const [applyConfirm, setApplyConfirm] = useState<'lump' | 'paid' | null>(null)

  if (!kind || !item) {
    return (
      <div className="surface p-8">
        <p className="mb-4">Liability not found.</p>
        <BackNav to="/liabilities" label="Back to liabilities" />
      </div>
    )
  }

  const card = kind === 'card' ? (item as CreditCard) : null
  const loan = kind === 'loan' ? (item as Loan) : null
  const commentaries = [...(item.commentaries ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const util = card && card.limit > 0 ? (card.balance / card.limit) * 100 : 0
  const paidPct =
    loan && loan.original > 0 ? ((loan.original - loan.balance) / loan.original) * 100 : 0
  const suggested = suggestRag(item, kind)
  const rag = item.ragStatus
  const dayInt = dailyInterestGbp(item.balance, item.apr)
  const moInt = monthlyInterestGbp(item.balance, item.apr)

  const basePay = item.minPay
  const extra = parseNum(extraPay)
  const scenarioMin = simulateSingleDebt(item.balance, item.apr, basePay)
  const scenarioBoost = simulateSingleDebt(item.balance, item.apr, basePay + extra)
  const lump = Math.min(parseNum(lumpSum), item.balance)
  const afterLumpBalance = Math.max(0, item.balance - lump)
  const debtImpact = portfolioDebtAfter(
    data.creditCards,
    data.loans,
    kind,
    id,
    afterLumpBalance,
  )
  const debtImpactPayoff = portfolioDebtAfter(data.creditCards, data.loans, kind, id, 0)

  const patchItem = (patch: Partial<CreditCard & Loan>) => {
    setData((prev) => {
      const apply = <T extends CreditCard | Loan>(row: T): T => {
        const next = { ...row, ...patch }
        if ('contactPhone' in patch && !patch.contactPhone) delete next.contactPhone
        if ('contactEmail' in patch && !patch.contactEmail) delete next.contactEmail
        if ('contactUrl' in patch && !patch.contactUrl) delete next.contactUrl
        return next
      }
      if (kind === 'card') {
        return {
          ...prev,
          creditCards: prev.creditCards.map((c) => (c.id === id ? apply(c) : c)),
        }
      }
      return {
        ...prev,
        loans: prev.loans.map((l) => (l.id === id ? apply(l) : l)),
      }
    })
  }

  const setRag = (status: RagStatus | undefined) => {
    patchItem({ ragStatus: status })
  }

  const openContact = () => {
    setContactForm({
      phone: item.contactPhone ?? '',
      email: item.contactEmail ?? '',
      url: item.contactUrl ?? '',
    })
    setContactEditing(true)
    setContactOpen(true)
  }

  const beginInlineContactEdit = () => {
    setContactForm({
      phone: item.contactPhone ?? '',
      email: item.contactEmail ?? '',
      url: item.contactUrl ?? '',
    })
    setContactEditing(true)
  }

  const cancelContactEdit = () => {
    setContactEditing(false)
    setContactOpen(false)
    setContactForm({
      phone: item.contactPhone ?? '',
      email: item.contactEmail ?? '',
      url: item.contactUrl ?? '',
    })
  }

  const saveContact = () => {
    const phone = contactForm.phone.trim()
    const email = contactForm.email.trim()
    const url = contactForm.url.trim()
    patchItem({
      contactPhone: phone || undefined,
      contactEmail: email || undefined,
      contactUrl: url || undefined,
    })
    setContactEditing(false)
    setContactOpen(false)
    success(phone || email || url ? 'Contacts saved' : 'Contacts cleared')
  }

  const clearContacts = () => {
    patchItem({
      contactPhone: undefined,
      contactEmail: undefined,
      contactUrl: undefined,
    })
    setContactForm({ phone: '', email: '', url: '' })
    setContactEditing(false)
    setContactOpen(false)
    setClearContactsConfirm(false)
    success('Contacts cleared')
  }

  const hasContacts = Boolean(item.contactPhone || item.contactEmail || item.contactUrl)

  const saveNote = () => {
    const text = noteText.trim()
    if (!text) return
    const now = new Date().toISOString()
    const list = item.commentaries ?? []
    if (editingNote) {
      patchItem({
        commentaries: list.map((c) =>
          c.id === editingNote.id ? { ...c, text, updatedAt: now } : c,
        ),
      })
    } else {
      patchItem({
        commentaries: [
          ...list,
          { id: nextCommentaryId(list), text, createdAt: now, updatedAt: now },
        ],
      })
    }
    setNoteText('')
    setEditingNote(null)
  }

  const applyBalance = (nextBalance: number, note: string) => {
    const now = new Date().toISOString()
    const list = item.commentaries ?? []
    patchItem({
      balance: Math.max(0, nextBalance),
      commentaries: [
        ...list,
        { id: nextCommentaryId(list), text: note, createdAt: now, updatedAt: now },
      ],
    })
  }

  const markPaidOff = () => {
    const now = new Date().toISOString().slice(0, 10)
    setData((prev) => {
      const paid = {
        name: item.name,
        original: kind === 'loan' ? (loan?.original ?? item.balance) : item.balance,
        paidDate: now,
      }
      if (kind === 'card') {
        return {
          ...prev,
          creditCards: prev.creditCards.filter((c) => c.id !== id),
          paidOff: [paid, ...prev.paidOff],
        }
      }
      return {
        ...prev,
        loans: prev.loans.filter((l) => l.id !== id),
        paidOff: [paid, ...prev.paidOff],
      }
    })
    navigate('/liabilities')
  }

  return (
    <div className="liability-workspace">
      <div className="liability-workspace-bar">
        <BackNav to="/liabilities" label="Back to liabilities" />
        <span className={ragClass(rag)}>{ragLabel(rag)}</span>
      </div>

      <PageHeader
        eyebrow={kind === 'card' ? 'Credit card' : 'Loan'}
        title={item.name}
        description="Full debt workspace — commentary, contacts, RAG, and pay-down vs your portfolio."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm btn-icon-edit" onClick={openContact}>
              <Pencil size={16} strokeWidth={1.75} className="icon-edit" aria-hidden />{' '}
              {hasContacts ? 'Edit contacts' : 'Add contacts'}
            </button>
            <Link to="/optimizer" className="btn-ghost btn-sm">
              Debt tools
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-xs text-text-subtle">
          Suggested: <span className="text-text-muted">{ragLabel(suggested)}</span>
        </span>
        <div className="flex gap-1 sm:ml-auto">
          {(['red', 'amber', 'green'] as RagStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`rag-chip ${rag === s ? 'is-active' : ''} rag-${s}`}
              onClick={() => setRag(rag === s ? undefined : s)}
              aria-pressed={rag === s}
              title={ragLabel(s)}
            >
              {s === 'red' ? 'R' : s === 'amber' ? 'A' : 'G'}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-px mb-6 sm:mb-8 ${privacyClass(privacy)}`}>
        <div className="surface p-4 sm:p-6">
          <p className="label-uppercase mb-2">Balance</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatGBP(item.balance)}</p>
        </div>
        <div className="surface p-4 sm:p-6">
          <p className="label-uppercase mb-2">APR</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums">{item.apr.toFixed(2)}%</p>
        </div>
        <div className="surface p-4 sm:p-6">
          <p className="label-uppercase mb-2">Interest / day</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-accent">{formatGBP(dayInt)}</p>
        </div>
        <div className="surface p-4 sm:p-6">
          <p className="label-uppercase mb-2">Portfolio debt</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatGBP(breakdown.liability.total)}</p>
        </div>
      </div>

      <section id="commentary" className="surface p-5 sm:p-8 mb-6 sm:mb-8 border-l-2 border-l-accent">
        <p className="eyebrow mb-3">Progress</p>
        <h3 className="text-lg font-bold tracking-tight mb-2">Commentary</h3>
        <p className="text-sm text-text-muted font-light mb-5">
          Log calls, emails, and negotiation notes. Each entry is date-stamped — newest first.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          <textarea
            className="w-full min-h-[7rem]"
            placeholder="e.g. Called Moorcroft — discussed settlement, callback Friday…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={saveNote}
              disabled={!noteText.trim()}
            >
              {editingNote ? 'Update note' : 'Add commentary'}
            </button>
            {editingNote && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setEditingNote(null)
                  setNoteText('')
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </div>

        <div className="space-y-px">
          {commentaries.map((c) => (
            <article key={c.id} className="surface-nested p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <p className="text-[11px] text-text-subtle tabular-nums">
                  {formatDateTime(c.createdAt)}
                  {c.updatedAt !== c.createdAt ? ` · edited ${formatDateTime(c.updatedAt)}` : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setEditingNote(c)
                      setNoteText(c.text)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setDeleteNoteId(c.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.text}</p>
            </article>
          ))}
          {commentaries.length === 0 && (
            <p className="text-sm text-text-subtle py-2">
              No commentary yet — add your first call or progress update above.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-px mb-8">
        <section className="surface p-5 sm:p-8 lg:col-span-2">
          <p className="eyebrow mb-3">Details</p>
          <h3 className="text-lg font-bold tracking-tight mb-4">Account</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-subtle">Min payment</dt>
              <dd className={`tabular-nums font-semibold ${privacyClass(privacy)}`}>
                {formatGBP(item.minPay)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-subtle">Est. interest / mo</dt>
              <dd className={`tabular-nums ${privacyClass(privacy)}`}>{formatGBP(moInt)}</dd>
            </div>
            {card && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-subtle">Limit</dt>
                  <dd className={`tabular-nums ${privacyClass(privacy)}`}>{formatGBP(card.limit)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-subtle">Utilisation</dt>
                  <dd className="tabular-nums">{formatPct(util, 0).replace('+', '')}</dd>
                </div>
              </>
            )}
            {loan && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-subtle">Original</dt>
                  <dd className={`tabular-nums ${privacyClass(privacy)}`}>
                    {formatGBP(loan.original)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-subtle">Paid down</dt>
                  <dd className="tabular-nums">{formatPct(paidPct, 0).replace('+', '')}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between gap-4 pt-2">
              <dt className="text-text-subtle">In net worth</dt>
              <dd>
                <button
                  type="button"
                  className="text-xs font-bold uppercase tracking-widest text-accent-bright"
                  onClick={() =>
                    patchItem({ includeInPortfolio: item.includeInPortfolio === false })
                  }
                >
                  {item.includeInPortfolio === false ? 'Excluded' : 'Included'}
                </button>
              </dd>
            </div>
          </dl>
          {card ? (
            <div className="progress-track mt-3" aria-hidden>
              <div className="progress-fill" style={{ width: `${Math.min(util, 100)}%` }} />
            </div>
          ) : null}
          {loan ? (
            <div className="progress-track mt-3" aria-hidden>
              <div
                className="progress-fill"
                style={{ width: `${Math.min(Math.max(paidPct, 0), 100)}%` }}
              />
            </div>
          ) : null}

          <div className="mt-8 pt-6 border-t border-border space-y-3" data-testid="liability-contacts">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="label-uppercase mb-0">Contacts</p>
              {!contactEditing ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm btn-icon-edit inline-flex items-center gap-1.5"
                  data-testid="liability-contacts-edit"
                  onClick={beginInlineContactEdit}
                >
                  <Pencil size={16} strokeWidth={1.75} className="icon-edit" aria-hidden />
                  {hasContacts ? 'Edit' : 'Add'}
                </button>
              ) : null}
            </div>

            {contactEditing ? (
              <form
                className="space-y-4"
                data-testid="liability-contacts-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  saveContact()
                }}
              >
                <Field label="Phone">
                  <input
                    type="tel"
                    autoComplete="tel"
                    data-testid="liability-contact-phone"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="+44…"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    data-testid="liability-contact-email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="collections@lender.com"
                  />
                </Field>
                <Field label="URL">
                  <input
                    type="url"
                    data-testid="liability-contact-url"
                    value={contactForm.url}
                    onChange={(e) => setContactForm({ ...contactForm, url: e.target.value })}
                    placeholder="https://"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn-primary btn-sm" data-testid="liability-contacts-save">
                    Save contacts
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={cancelContactEdit}>
                    Cancel
                  </button>
                  {hasContacts ? (
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-red-500 inline-flex items-center gap-1"
                      data-testid="liability-contacts-clear"
                      onClick={() => setClearContactsConfirm(true)}
                    >
                      <Trash2 size={14} aria-hidden /> Clear all
                    </button>
                  ) : null}
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                {item.contactPhone ? (
                  <a
                    href={`tel:${item.contactPhone}`}
                    className="flex items-center gap-2 text-sm text-text-muted hover:text-accent min-h-11"
                  >
                    <Phone size={14} strokeWidth={1.5} /> {item.contactPhone}
                  </a>
                ) : (
                  <p className="text-sm text-text-subtle">No phone</p>
                )}
                {item.contactEmail ? (
                  <a
                    href={`mailto:${item.contactEmail}`}
                    className="flex items-center gap-2 text-sm text-text-muted hover:text-accent min-h-11"
                  >
                    <Mail size={14} strokeWidth={1.5} /> {item.contactEmail}
                  </a>
                ) : (
                  <p className="text-sm text-text-subtle">No email</p>
                )}
                {item.contactUrl ? (
                  <a
                    href={
                      item.contactUrl.startsWith('http')
                        ? item.contactUrl
                        : `https://${item.contactUrl}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-text-muted hover:text-accent break-all min-h-11"
                  >
                    <ExternalLink size={14} strokeWidth={1.5} /> {item.contactUrl}
                  </a>
                ) : (
                  <p className="text-sm text-text-subtle">No URL</p>
                )}
                {!hasContacts ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm mt-1"
                    onClick={beginInlineContactEdit}
                  >
                    Add phone, email, or URL
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className="surface p-6 sm:p-8 lg:col-span-3">
          <p className="eyebrow mb-3">Pay down</p>
          <h3 className="text-lg font-bold tracking-tight mb-2">Scenarios</h3>
          <p className="text-sm text-text-muted font-light mb-6 max-w-2xl">
            Compare minimum-only vs boosted payments. Lump-sum preview updates portfolio total debt
            without saving until you apply.
          </p>

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-px mb-6 ${privacyClass(privacy)}`}>
            <div className="surface-nested p-5">
              <p className="label-uppercase mb-2">Min only</p>
              <p className="text-xl font-bold tabular-nums mb-1">
                {scenarioMin.payoffMonth != null
                  ? `${scenarioMin.payoffMonth} mo`
                  : 'Does not clear'}
              </p>
              <p className="text-xs text-text-subtle">
                Interest {formatGBP(scenarioMin.totalInterest)} · Pay {formatGBP(basePay)}/mo
              </p>
            </div>
            <div className="surface-nested p-5 border-l border-l-accent">
              <p className="label-uppercase mb-2">Min + extra</p>
              <p className="text-xl font-bold tabular-nums text-accent mb-1">
                {scenarioBoost.payoffMonth != null
                  ? `${scenarioBoost.payoffMonth} mo`
                  : 'Does not clear'}
              </p>
              <p className="text-xs text-text-subtle">
                Interest {formatGBP(scenarioBoost.totalInterest)}
                {scenarioMin.payoffMonth != null && scenarioBoost.payoffMonth != null
                  ? ` · Save ${scenarioMin.payoffMonth - scenarioBoost.payoffMonth} mo`
                  : ''}
                {' · '}
                Interest saved{' '}
                {formatGBP(Math.max(0, scenarioMin.totalInterest - scenarioBoost.totalInterest))}
              </p>
            </div>
          </div>

          <Field label={`Extra monthly payment (GBP) on top of min ${formatGBP(basePay)}`}>
            <input
              type="text"
              inputMode="decimal"
              value={extraPay}
              onChange={(e) => setExtraPay(e.target.value)}
            />
          </Field>

          <div className="mt-6 pt-6 border-t border-border">
            <Field label="Lump-sum payment (GBP)">
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 1000"
                value={lumpSum}
                onChange={(e) => setLumpSum(e.target.value)}
              />
            </Field>
            {lump > 0 && (
              <div className={`mt-4 text-sm space-y-1 ${privacyClass(privacy)}`}>
                <p>
                  New balance <span className="font-semibold tabular-nums">{formatGBP(afterLumpBalance)}</span>
                </p>
                <p>
                  Portfolio debt{' '}
                  <span className="font-semibold tabular-nums">{formatGBP(debtImpact.currentTotal)}</span>
                  {' → '}
                  <span className="font-semibold tabular-nums text-accent">
                    {formatGBP(debtImpact.total)}
                  </span>{' '}
                  <span className="text-text-subtle">({formatGBP(debtImpact.delta, { signed: true })})</span>
                </p>
                <p className="text-text-subtle">
                  Net worth impact ≈ {formatGBP(-debtImpact.delta, { signed: true })} (liabilities
                  fall).
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={lump <= 0}
                onClick={() => setApplyConfirm('lump')}
              >
                Apply lump sum
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setApplyConfirm('paid')}
              >
                Mark paid off
              </button>
            </div>
            <p className="text-xs text-text-subtle mt-3">
              Paying this off entirely would drop portfolio debt to{' '}
              <span className={privacyClass(privacy)}>{formatGBP(debtImpactPayoff.total)}</span>.
            </p>
          </div>

          {scenarioBoost.schedule.length > 0 && (
            <div className="mt-8 overflow-x-auto">
              <p className="label-uppercase mb-3">First 12 months (boosted)</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-text-subtle border-b border-border">
                    <th className="py-2 pr-3">Mo</th>
                    <th className="py-2 pr-3 text-right">Pay</th>
                    <th className="py-2 pr-3 text-right">Interest</th>
                    <th className="py-2 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody className={privacyClass(privacy)}>
                  {scenarioBoost.schedule.slice(0, 12).map((row) => (
                    <tr key={row.month} className="border-b border-border/60">
                      <td className="py-2 pr-3 tabular-nums">{row.month}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatGBP(row.payment)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatGBP(row.interest)}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">
                        {formatGBP(row.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={contactOpen}
        size="full"
        title="Contact details"
        onClose={cancelContactEdit}
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            saveContact()
          }}
        >
          <Field label="Telephone">
            <input
              type="tel"
              autoComplete="tel"
              value={contactForm.phone}
              onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              placeholder="+44…"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              placeholder="collections@lender.com"
            />
          </Field>
          <Field label="URL">
            <input
              type="url"
              value={contactForm.url}
              onChange={(e) => setContactForm({ ...contactForm, url: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-3">
            {hasContacts ? (
              <button
                type="button"
                className="btn-ghost text-red-500 mr-auto"
                onClick={() => setClearContactsConfirm(true)}
              >
                Clear all
              </button>
            ) : null}
            <button type="button" className="btn-ghost" onClick={cancelContactEdit}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={clearContactsConfirm}
        title="Clear contacts"
        body="Remove phone, email, and URL for this lender?"
        confirmLabel="Clear"
        onClose={() => setClearContactsConfirm(false)}
        onConfirm={clearContacts}
      />

      <ConfirmDialog
        open={deleteNoteId !== null}
        title="Delete commentary"
        body="Remove this progress note permanently?"
        onClose={() => setDeleteNoteId(null)}
        onConfirm={() => {
          if (deleteNoteId == null) return
          patchItem({
            commentaries: (item.commentaries ?? []).filter((c) => c.id !== deleteNoteId),
          })
          setDeleteNoteId(null)
        }}
      />

      <ConfirmDialog
        open={applyConfirm === 'lump'}
        title="Apply lump-sum payment"
        body={`Reduce ${item.name} balance by ${formatGBP(lump)} and log a commentary entry?`}
        onClose={() => setApplyConfirm(null)}
        onConfirm={() => {
          applyBalance(
            afterLumpBalance,
            `Lump-sum applied: −${lump.toFixed(2)} GBP. New balance ${afterLumpBalance.toFixed(2)} GBP.`,
          )
          setLumpSum('')
          setApplyConfirm(null)
        }}
      />

      <ConfirmDialog
        open={applyConfirm === 'paid'}
        title="Mark as paid off"
        body="Move this liability to Paid off and remove it from active debt?"
        onClose={() => setApplyConfirm(null)}
        onConfirm={() => {
          markPaidOff()
          setApplyConfirm(null)
        }}
      />

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary liability detail actions">
        <Link to="/" className="btn-primary btn-sm">
          Today
        </Link>
        <Link to="/liabilities" className="btn-secondary btn-sm">
          Liabilities
        </Link>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
