import { useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { PortfolioSeriesChart } from '../components/charts/PortfolioSeriesChart'
import { HoldingPriceChart } from '../components/charts/HoldingPriceChart'
import { OverflowMenu } from '../components/ui/OverflowMenu'
import { PageHeader } from '../components/ui/PageHeader'
import { BackNav } from '../components/ui/BackNav'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { TradeHistoryModal } from '../components/ui/TradeHistoryModal'
import { TradeModal } from '../components/ui/TradeModal'
import { usePortfolio } from '../context/PortfolioContext'
import { ragClass, ragLabel, nextCommentaryId } from '../domain/liabilityHelpers'
import { ragFromPct } from '../domain/alerts'
import { seedHoldingSeries } from '../domain/holdingHistory'
import {
  applyOpeningBalance,
  applyTrade,
  deleteJournalTrade,
  isTradeType,
  journalForSymbol,
  needsOpeningBalance,
  rebuildHoldingsFromJournal,
  tradeJournalForSymbol,
  upsertJournalTrade,
} from '../domain/trades'
import type {
  CryptoHolding,
  EquityHolding,
  JournalEntry,
  ProgressCommentary,
  RagStatus,
} from '../domain/types'
import { listMarketTickers } from '../storage/marketsStore'
import { formatDate, formatDateTime, formatGBP, formatGBPPrecise, formatPct, formatQty, privacyClass } from '../utils/format'

export function HoldingDetailPage() {
  const { kind: kindParam, id: idParam } = useParams()
  const { pathname } = useLocation()
  const kind =
    kindParam === 'crypto' || kindParam === 'equity'
      ? kindParam
      : pathname.startsWith('/equities')
        ? 'equity'
        : pathname.startsWith('/crypto')
          ? 'crypto'
          : null
  const id = Number(idParam)
  const { data, privacy, setData } = usePortfolio()

  const item: CryptoHolding | EquityHolding | null = useMemo(() => {
    if (!kind || !Number.isFinite(id)) return null
    if (kind === 'crypto') return data.crypto.find((c) => c.id === id) ?? null
    return data.equities.find((e) => e.id === id) ?? null
  }, [data.crypto, data.equities, kind, id])

  const [noteText, setNoteText] = useState('')
  const [editingNote, setEditingNote] = useState<ProgressCommentary | null>(null)
  const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null)
  const [metaOpen, setMetaOpen] = useState(false)
  const [meta, setMeta] = useState({ platform: '', contactUrl: '' })
  const [tradeOpen, setTradeOpen] = useState(false)
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState<JournalEntry | null>(null)
  const [deleteTradeId, setDeleteTradeId] = useState<number | null>(null)

  const trades = useMemo(
    () => (item ? journalForSymbol(data, item.symbol).filter((j) => isTradeType(j.type)) : []),
    [data, item],
  )

  if (!kind || !item) {
    return (
      <div className="surface p-8">
        <p className="mb-4">Holding not found.</p>
        <BackNav
          to={kind === 'equity' ? '/equities' : '/crypto'}
          label={kind === 'equity' ? 'Back to equities' : 'Back to crypto'}
        />
      </div>
    )
  }

  const showOpening = needsOpeningBalance(data, item.symbol, kind === 'crypto' ? 'crypto' : 'equity')
  const isCrypto = kind === 'crypto'
  const crypto = isCrypto ? (item as CryptoHolding) : null
  const equity = !isCrypto ? (item as EquityHolding) : null
  const qty = crypto ? crypto.qty : equity!.shares
  const price = crypto
    ? crypto.price
    : equity!.livePrice > 0
      ? equity!.livePrice
      : equity!.avgCost
  const cost = crypto ? crypto.cost : equity!.shares * equity!.avgCost
  const value = qty * price
  const pnl = value - cost
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
  const suggested = ragFromPct(pnlPct)
  const rag = item.ragStatus
  const commentaries = [...(item.commentaries ?? [])].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  )

  let yieldPct: number | undefined
  if (!isCrypto) {
    if (equity?.yieldPct != null && equity.yieldPct > 0) yieldPct = equity.yieldPct
    else {
      const t = listMarketTickers('equity').find(
        (x) => x.symbol.toUpperCase() === item.symbol.toUpperCase(),
      )
      if (t?.yieldPct != null && t.yieldPct > 0) yieldPct = t.yieldPct
    }
  }

  const unitCost = isCrypto
    ? crypto && crypto.qty > 0
      ? crypto.cost / crypto.qty
      : undefined
    : equity?.avgCost
  const priceSeed = seedHoldingSeries(
    isCrypto ? 'crypto' : 'equity',
    item.symbol,
    price,
    unitCost,
  )

  const patch = (p: Partial<CryptoHolding & EquityHolding>) => {
    setData((prev) => {
      if (kind === 'crypto') {
        return {
          ...prev,
          crypto: prev.crypto.map((c) => (c.id === id ? { ...c, ...p } : c)),
        }
      }
      return {
        ...prev,
        equities: prev.equities.map((e) => (e.id === id ? { ...e, ...p } : e)),
      }
    })
  }

  const saveNote = () => {
    const text = noteText.trim()
    if (!text) return
    const now = new Date().toISOString()
    const list = item.commentaries ?? []
    if (editingNote) {
      patch({
        commentaries: list.map((c) =>
          c.id === editingNote.id ? { ...c, text, updatedAt: now } : c,
        ),
      })
    } else {
      patch({
        commentaries: [
          ...list,
          { id: nextCommentaryId(list), text, createdAt: now, updatedAt: now },
        ],
      })
    }
    setNoteText('')
    setEditingNote(null)
  }

  return (
    <div className="liability-workspace">
      <div className="liability-workspace-bar">
        <BackNav
          to={isCrypto ? '/crypto' : '/equities'}
          label={isCrypto ? 'Back to crypto' : 'Back to equities'}
        />
        <span className={ragClass(rag)}>{ragLabel(rag)}</span>
      </div>

      <PageHeader
        eyebrow={isCrypto ? 'Crypto' : 'Equity'}
        title={`${item.symbol} · ${item.name}`}
        description="P&L, dated buys/sells, price history, and commentary."
        action={
          <OverflowMenu
            label={`More actions for ${item.symbol}`}
            leading={
              <>
                <button
                  type="button"
                  className="btn-primary btn-sm min-h-11 md:min-h-9"
                  onClick={() => {
                    setEditingTrade(null)
                    setTradeSide('buy')
                    setTradeOpen(true)
                  }}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm min-h-11 md:min-h-9"
                  onClick={() => {
                    setEditingTrade(null)
                    setTradeSide('sell')
                    setTradeOpen(true)
                  }}
                >
                  Sell
                </button>
              </>
            }
            items={[
              {
                id: 'history',
                label: 'Import history',
                onClick: () => setHistoryOpen(true),
              },
              {
                id: 'meta',
                label: 'Platform / URL',
                onClick: () => {
                  setMeta({ platform: item.platform ?? '', contactUrl: item.contactUrl ?? '' })
                  setMetaOpen(true)
                },
              },
            ]}
          />
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
              onClick={() => patch({ ragStatus: rag === s ? undefined : s })}
              aria-pressed={rag === s}
            >
              {s === 'red' ? 'R' : s === 'amber' ? 'A' : 'G'}
            </button>
          ))}
        </div>
      </div>

      <div className={`holding-price-strip surface p-5 sm:p-6 mb-6 ${privacyClass(privacy)}`}>
        <p className="label-uppercase mb-2">Live price</p>
        <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight">
          {formatGBPPrecise(price)}
        </p>
        <p className={`mt-1 text-sm font-semibold tabular-nums ${pnl >= 0 ? 'text-accent' : 'text-text-muted'}`}>
          {formatGBP(pnl, { signed: true })} · {formatPct(cost > 0 ? (pnl / cost) * 100 : 0)}
        </p>
        {yieldPct != null ? (
          <p className="mt-2 text-sm text-text-muted tabular-nums">
            Dividend yield {yieldPct.toFixed(yieldPct >= 10 ? 1 : 2)}%
          </p>
        ) : null}
      </div>

      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-px mb-6 ${privacyClass(privacy)}`}>
        <div className="surface p-4 sm:p-6">
          <p className="label-uppercase mb-2">Value</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatGBP(value)}</p>
        </div>
        <div className="surface p-4 sm:p-6">
          <p className="label-uppercase mb-2">Cost</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatGBP(cost)}</p>
        </div>
        <div className="surface p-4 sm:p-6">
          <p className="label-uppercase mb-2">P&amp;L</p>
          <p className={`text-xl sm:text-2xl font-bold tabular-nums ${pnl >= 0 ? 'text-accent' : ''}`}>
            {formatGBP(pnl, { signed: true })}
          </p>
        </div>
        <div className="surface p-4 sm:p-6">
          <p className="label-uppercase mb-2">Qty · Price</p>
          <p className="text-lg sm:text-xl font-bold tabular-nums">
            {formatQty(qty)} · {formatGBPPrecise(price)}
          </p>
          <p className="text-xs text-text-subtle mt-1">{formatPct(pnlPct)}</p>
        </div>
      </div>

      {showOpening && (
        <div className="surface border-l-2 border-l-accent px-5 py-4 mb-6">
          <p className="text-sm font-semibold uppercase tracking-wider mb-1">Opening balance</p>
          <p className="text-sm text-text-muted font-light mb-3">
            This holding has quantity from an import, but no dated buys/sells yet. Create an opening
            balance trade so future edits recalculate cost correctly — or import your full history.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() =>
                setData((prev) =>
                  applyOpeningBalance(prev, item.symbol, isCrypto ? 'crypto' : 'equity'),
                )
              }
            >
              Create opening balance
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setHistoryOpen(true)}>
              Import full history
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <HoldingPriceChart
          data={data}
          kind={isCrypto ? 'crypto' : 'equity'}
          symbol={item.symbol}
          seed={priceSeed}
          privacy={privacy}
          title="Price history"
        />
      </div>

      <div className="surface p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="label-uppercase mb-1">Trades</p>
            <h3 className="text-base font-bold tracking-tight">Buys &amp; sells</h3>
            <p className="text-xs text-text-subtle mt-1 max-w-xl">
              Enter your full dated history so qty and cost match reality. Edit or delete any line —
              holdings recalculate from the journal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                setEditingTrade(null)
                setTradeSide('buy')
                setTradeOpen(true)
              }}
            >
              Add buy
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setEditingTrade(null)
                setTradeSide('sell')
                setTradeOpen(true)
              }}
            >
              Add sell
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setHistoryOpen(true)}>
              Import history
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={tradeJournalForSymbol(data, item.symbol).length === 0}
              title={
                tradeJournalForSymbol(data, item.symbol).length === 0
                  ? 'Add trades first — recalculate would zero this holding'
                  : 'Rebuild qty/cost from journal'
              }
              onClick={() =>
                setData((prev) =>
                  rebuildHoldingsFromJournal(prev, {
                    onlySymbol: item.symbol,
                    kindHint: isCrypto ? 'crypto' : 'equity',
                  }),
                )
              }
            >
              Recalculate cost
            </button>
          </div>
        </div>
        {trades.length === 0 ? (
          <p className="text-sm text-text-subtle font-light py-6 text-center">
            No journal trades for {item.symbol} yet. Use Import history (multi-row / CSV) or add
            buys and sells with specific dates.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-text-subtle">
                  <th className="py-2 pr-3 font-bold">Date</th>
                  <th className="py-2 pr-3 font-bold">Type</th>
                  <th className="py-2 pr-3 font-bold text-right">Qty</th>
                  <th className="py-2 pr-3 font-bold text-right">Price</th>
                  <th className="py-2 pr-3 font-bold text-right">Fees</th>
                  <th className="py-2 pr-3 font-bold text-right">Total</th>
                  <th className="py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-3 tabular-nums text-text-muted">{formatDate(t.date)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatQty(t.qty)}</td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${privacyClass(privacy)}`}>
                      {formatGBPPrecise(t.price)}
                    </td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${privacyClass(privacy)}`}>
                      {formatGBPPrecise(t.fees)}
                    </td>
                    <td className={`py-2.5 pr-3 text-right font-semibold tabular-nums ${privacyClass(privacy)}`}>
                      {formatGBP(t.total)}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setEditingTrade(t)
                          setTradeOpen(true)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => setDeleteTradeId(t.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-6">
        <PortfolioSeriesChart
          history={data.history}
          privacy={privacy}
          title={isCrypto ? 'Crypto book' : 'Equity book'}
          eyebrow="Class timeline"
          primary={isCrypto ? 'crypto' : 'equity'}
          defaultRange="12M"
          heightClass="h-52 sm:h-60"
        />
      </div>

      <section id="commentary" className="surface p-5 sm:p-8 mb-6 border-l-2 border-l-accent">
        <p className="eyebrow mb-3">Progress</p>
        <h3 className="text-lg font-bold tracking-tight mb-2">Commentary</h3>
        <p className="text-sm text-text-muted font-light mb-5">
          Thesis updates, rebalance notes, platform tickets — date-stamped.
        </p>
        <div className="flex flex-col gap-3 mb-6">
          <textarea
            className="w-full min-h-[7rem]"
            placeholder="e.g. Adding on dip; staking move pending…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary btn-sm" onClick={saveNote} disabled={!noteText.trim()}>
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
                Cancel
              </button>
            )}
          </div>
        </div>
        <div className="space-y-px">
          {commentaries.map((c) => (
            <article key={c.id} className="surface-nested p-4">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <p className="text-[11px] text-text-subtle tabular-nums">{formatDateTime(c.createdAt)}</p>
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
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setDeleteNoteId(c.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.text}</p>
            </article>
          ))}
          {commentaries.length === 0 && (
            <p className="text-sm text-text-subtle">No commentary yet.</p>
          )}
        </div>
      </section>

      <section className="surface p-5 sm:p-8 mb-6">
        <p className="label-uppercase mb-3">Links</p>
        {item.platform && <p className="text-sm mb-2">Platform: {item.platform}</p>}
        {item.contactUrl ? (
          <a
            href={item.contactUrl.startsWith('http') ? item.contactUrl : `https://${item.contactUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-accent"
          >
            <ExternalLink size={14} /> {item.contactUrl}
          </a>
        ) : (
          <p className="text-sm text-text-subtle">No URL set</p>
        )}
        <button
          type="button"
          className="mt-4 text-[10px] font-bold uppercase tracking-widest text-accent"
          onClick={() =>
            patch({ includeInPortfolio: item.includeInPortfolio === false })
          }
        >
          {item.includeInPortfolio === false ? 'Excluded from NW' : 'Included in NW'}
        </button>
      </section>

      <Modal open={metaOpen} size="full" title="Platform / URL" onClose={() => setMetaOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            patch({
              platform: meta.platform.trim() || undefined,
              contactUrl: meta.contactUrl.trim() || undefined,
            })
            setMetaOpen(false)
          }}
        >
          <Field label="Platform">
            <input
              value={meta.platform}
              onChange={(e) => setMeta({ ...meta, platform: e.target.value })}
              placeholder="Coinbase, HL, IBKR…"
            />
          </Field>
          <Field label="URL">
            <input
              type="url"
              value={meta.contactUrl}
              onChange={(e) => setMeta({ ...meta, contactUrl: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => setMetaOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <TradeModal
        key={editingTrade ? `edit-${editingTrade.id}` : `new-${tradeSide}`}
        open={tradeOpen}
        kind={isCrypto ? 'crypto' : 'equity'}
        symbol={item.symbol}
        defaultPrice={price}
        defaultSide={tradeSide}
        data={data}
        initial={
          editingTrade
            ? {
                side: editingTrade.type.toLowerCase() === 'sell' ? 'sell' : 'buy',
                date: editingTrade.date,
                qty: editingTrade.qty,
                price: editingTrade.price,
                fees: editingTrade.fees,
                notes: editingTrade.notes,
                platform: editingTrade.platform,
              }
            : undefined
        }
        onClose={() => {
          setTradeOpen(false)
          setEditingTrade(null)
        }}
        onSave={(vals) => {
          const kindHint = isCrypto ? 'crypto' : 'equity'
          if (editingTrade) {
            const total =
              vals.side === 'buy'
                ? vals.qty * vals.price + vals.fees
                : Math.max(0, vals.qty * vals.price - vals.fees)
            setData((prev) =>
              upsertJournalTrade(
                prev,
                {
                  ...editingTrade,
                  date: vals.date.slice(0, 10),
                  type: vals.side,
                  asset: item.symbol,
                  qty: vals.qty,
                  price: vals.price,
                  fees: vals.fees,
                  total,
                  notes: vals.notes,
                  platform: vals.platform,
                },
                kindHint,
              ),
            )
          } else {
            setData((prev) =>
              applyTrade(prev, {
                kind: kindHint,
                side: vals.side,
                symbol: item.symbol,
                name: item.name,
                date: vals.date,
                qty: vals.qty,
                price: vals.price,
                fees: vals.fees,
                notes: vals.notes,
                platform: vals.platform,
                holdingId: item.id,
              }),
            )
          }
          setEditingTrade(null)
        }}
      />

      <TradeHistoryModal
        open={historyOpen}
        kind={isCrypto ? 'crypto' : 'equity'}
        symbol={item.symbol}
        name={item.name}
        data={data}
        onClose={() => setHistoryOpen(false)}
        onApply={(next) => setData(next)}
      />

      <ConfirmDialog
        open={deleteTradeId !== null}
        title="Delete trade"
        body="Remove this buy/sell from the journal? Quantity and cost basis will recalculate from remaining trades."
        onClose={() => setDeleteTradeId(null)}
        onConfirm={() => {
          if (deleteTradeId == null) return
          setData((prev) =>
            deleteJournalTrade(
              prev,
              deleteTradeId,
              isCrypto ? 'crypto' : 'equity',
              item.symbol,
            ),
          )
          setDeleteTradeId(null)
        }}
      />

      <ConfirmDialog
        open={deleteNoteId !== null}
        title="Delete commentary"
        body="Remove this note?"
        onClose={() => setDeleteNoteId(null)}
        onConfirm={() => {
          if (deleteNoteId == null) return
          patch({
            commentaries: (item.commentaries ?? []).filter((c) => c.id !== deleteNoteId),
          })
          setDeleteNoteId(null)
        }}
      />
    </div>
  )
}
