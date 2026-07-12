/** Bulk dated trade entry + CSV import for one holding. */

import { useEffect, useRef, useState } from 'react'
import { Field, Modal, parseNum } from './Modal'
import {
  applyTradesBatch,
  emptyTradeDraftRow,
  replaceSymbolTrades,
  tradeJournalForSymbol,
  type TradeDraftRow,
  type TradeKind,
  type TradeSide,
} from '../../domain/trades'
import { lookupPriceOnDate } from '../../domain/staticPrices'
import { parseTradeCsv } from '../../services/tradeCsvImport'
import type { PortfolioData } from '../../domain/types'

interface Props {
  open: boolean
  kind: TradeKind
  symbol: string
  name?: string
  data: PortfolioData
  onClose: () => void
  onApply: (next: PortfolioData) => void
}

export function TradeHistoryModal({
  open,
  kind,
  symbol,
  name,
  data,
  onClose,
  onApply,
}: Props) {
  const [rows, setRows] = useState<TradeDraftRow[]>([emptyTradeDraftRow('buy')])
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setRows([emptyTradeDraftRow('buy'), emptyTradeDraftRow('buy')])
    setErrors([])
    setStatus(null)
    const existing = tradeJournalForSymbol(data, symbol).length
    setMode(existing > 0 ? 'append' : 'replace')
  }, [open, symbol]) // data read once on open

  const updateRow = (id: string, patch: Partial<TradeDraftRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const fillPrice = async (row: TradeDraftRow) => {
    const hit = await lookupPriceOnDate(kind, symbol, row.date, data)
    if (!hit) {
      setStatus(`No market close found on/before ${row.date} for ${symbol}.`)
      return
    }
    updateRow(row.id, { price: String(hit.price) })
    setStatus(
      hit.date === row.date
        ? `Filled ${symbol} close ${hit.price} on ${hit.date}.`
        : `Filled nearest prior close ${hit.price} (${hit.date}).`,
    )
  }

  const onCsv = async (file: File) => {
    const text = await file.text()
    const parsed = parseTradeCsv(text, { kind, symbol, name })
    if (parsed.errors.length && parsed.trades.length === 0) {
      setErrors(parsed.errors)
      return
    }
    setErrors(parsed.errors)
    setRows(
      parsed.trades.map((t) => ({
        id: emptyTradeDraftRow().id,
        side: t.side,
        date: t.date,
        qty: String(t.qty),
        price: String(t.price),
        fees: String(t.fees ?? 0),
        notes: t.notes ?? '',
      })),
    )
    setStatus(`Loaded ${parsed.trades.length} trade(s) from CSV. Review and save.`)
  }

  const save = () => {
    const trades = []
    const errs: string[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const qty = parseNum(r.qty)
      const price = parseNum(r.price)
      const fees = parseNum(r.fees)
      if (!r.date || !(qty > 0) || !(price >= 0)) {
        if (r.qty.trim() || r.price.trim()) {
          errs.push(`Row ${i + 1}: need valid date, qty, and price`)
        }
        continue
      }
      trades.push({
        kind,
        side: r.side as TradeSide,
        symbol,
        name,
        date: r.date,
        qty,
        price,
        fees,
        notes: r.notes.trim() || undefined,
      })
    }
    if (trades.length === 0) {
      setErrors(errs.length ? errs : ['Add at least one valid trade row'])
      return
    }
    const next =
      mode === 'replace'
        ? replaceSymbolTrades(data, symbol, kind, trades)
        : applyTradesBatch(data, trades)
    onApply(next)
    onClose()
  }

  const existingCount = tradeJournalForSymbol(data, symbol).length

  return (
    <Modal open={open} size="full" title={`Import ${symbol} trade history`} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-text-muted font-light">
          Enter every dated buy and sell (or paste CSV). Quantity and average cost rebuild from the
          journal for {symbol}.
        </p>
        <p className="text-xs text-text-subtle">
          CSV columns: <code className="text-accent">date,side,qty,price[,fees][,notes]</code>
        </p>

        {existingCount > 0 && (
          <div className="flex flex-wrap gap-2 border border-border p-3">
            <button
              type="button"
              className={`btn-sm ${mode === 'append' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('append')}
            >
              Append to {existingCount} existing
            </button>
            <button
              type="button"
              className={`btn-sm ${mode === 'replace' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('replace')}
            >
              Replace all trades
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setRows((prev) => [...prev, emptyTradeDraftRow('buy')])}
          >
            Add row
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            Import CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onCsv(f)
              e.target.value = ''
            }}
          />
        </div>

        {status && (
          <p className="text-sm text-accent" role="status">
            {status}
          </p>
        )}
        {errors.length > 0 && (
          <ul className="text-sm text-text-muted list-disc pl-5 space-y-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-text-subtle">
                <th className="py-2 pr-2 font-bold">Side</th>
                <th className="py-2 pr-2 font-bold">Date</th>
                <th className="py-2 pr-2 font-bold">Qty</th>
                <th className="py-2 pr-2 font-bold">Price</th>
                <th className="py-2 pr-2 font-bold">Fees</th>
                <th className="py-2 pr-2 font-bold">Notes</th>
                <th className="py-2 font-bold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 align-top">
                  <td className="py-2 pr-2">
                    <select
                      className="min-w-[5.5rem]"
                      value={r.side}
                      onChange={(e) => updateRow(r.id, { side: e.target.value as TradeSide })}
                      aria-label="Side"
                    >
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => updateRow(r.id, { date: e.target.value })}
                      aria-label="Date"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-24"
                      value={r.qty}
                      onChange={(e) => updateRow(r.id, { qty: e.target.value })}
                      aria-label="Quantity"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-28"
                        value={r.price}
                        onChange={(e) => updateRow(r.id, { price: e.target.value })}
                        aria-label="Price"
                      />
                      <button
                        type="button"
                        className="btn-ghost btn-sm shrink-0"
                        title="Fill from market history"
                        onClick={() => void fillPrice(r)}
                      >
                        Px
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-20"
                      value={r.fees}
                      onChange={(e) => updateRow(r.id, { fees: e.target.value })}
                      aria-label="Fees"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      className="w-36"
                      value={r.notes}
                      onChange={(e) => updateRow(r.id, { notes: e.target.value })}
                      aria-label="Notes"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      disabled={rows.length <= 1}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Field label="Tip">
          <p className="text-sm text-text-muted font-light">
            After saving, use Edit / Delete on individual trades if you need to correct a line —
            cost basis recalculates from the journal automatically.
          </p>
        </Field>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            Save {rows.length} row{rows.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
