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
import {
  detectBrokerPreset,
  listBrokerTradePresets,
  parseTradeCsv,
  type TradeCsvDateOrder,
} from '../../services/tradeCsvImport'
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
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [dateOrder, setDateOrder] = useState<TradeCsvDateOrder>('dmy')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setRows([emptyTradeDraftRow('buy'), emptyTradeDraftRow('buy')])
    setErrors([])
    setStatus(null)
    setPasteText('')
    setShowPaste(false)
    setDateOrder('dmy')
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

  const loadParsedCsv = (text: string, source: 'file' | 'paste') => {
    const firstLine = text.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith('#')) ?? ''
    const headers = firstLine.split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, ''))
    const detected = detectBrokerPreset(headers)
    const order = dateOrder || detected.dateOrder
    if (detected.id !== 'generic') {
      setDateOrder(detected.dateOrder)
    }
    const parsed = parseTradeCsv(text, { kind, symbol, name, dateOrder: order })
    if (parsed.errors.length && parsed.trades.length === 0) {
      setErrors(parsed.errors)
      setStatus(null)
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
    const brokerLabel = parsed.broker?.label ?? detected.label
    setStatus(
      `Loaded ${parsed.trades.length} trade(s) from ${source === 'paste' ? 'paste' : 'CSV'}${
        brokerLabel ? ` · ${brokerLabel}` : ''
      }. Review and save.`,
    )
    if (source === 'paste') {
      setShowPaste(false)
      setPasteText('')
    }
  }

  const onCsv = async (file: File) => {
    const text = await file.text()
    loadParsedCsv(text, 'file')
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
          Enter every dated buy and sell, paste a broker CSV, or import a file. Quantity and average
          cost rebuild from the journal for {symbol}.
        </p>
        <p className="text-xs text-text-subtle">
          CSV columns:{' '}
          <code className="text-accent">date,side,qty,price[,fees][,notes][,platform]</code>
          . Also accepts IBKR / Trading 212 / Coinbase export headers (
          {listBrokerTradePresets()
            .filter((p) => p.id !== 'generic')
            .map((p) => p.label)
            .join(' · ')}
          ).
        </p>

        {existingCount > 0 && (
          <div
            className="flex flex-wrap gap-2 border border-border p-3"
            role="group"
            aria-label="Import mode"
          >
            <button
              type="button"
              className={`btn-sm ${mode === 'append' ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={mode === 'append'}
              onClick={() => setMode('append')}
            >
              Append to {existingCount} existing
            </button>
            <button
              type="button"
              className={`btn-sm ${mode === 'replace' ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={mode === 'replace'}
              onClick={() => setMode('replace')}
            >
              Replace all trades
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setRows((prev) => [...prev, emptyTradeDraftRow('buy')])}
          >
            Add row
          </button>
          <button
            type="button"
            className={`btn-sm ${showPaste ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={showPaste}
            aria-expanded={showPaste}
            onClick={() => setShowPaste((v) => !v)}
          >
            Paste CSV
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            Import file
          </button>
          <label className="flex items-center gap-2 text-xs text-text-muted ml-auto">
            <span className="label-uppercase">Dates</span>
            <select
              className="text-sm"
              value={dateOrder}
              onChange={(e) => setDateOrder(e.target.value as TradeCsvDateOrder)}
              aria-label="Ambiguous date order for pasted CSV"
            >
              <option value="dmy">D/M/Y (UK)</option>
              <option value="mdy">M/D/Y (US)</option>
            </select>
          </label>
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

        {showPaste ? (
          <div className="space-y-3 border border-border p-4">
            <label className="block">
              <span className="label-uppercase block mb-2">Paste broker CSV</span>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                className="w-full font-mono text-sm"
                placeholder={'date,side,qty,price,fees,notes\n2024-01-15,buy,10,180.50,1.00,IBKR'}
                aria-label="Paste trade CSV text"
                style={{ fontSize: 16 }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={!pasteText.trim()}
                onClick={() => loadParsedCsv(pasteText, 'paste')}
              >
                Parse pasted CSV
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setPasteText('')
                  setShowPaste(false)
                }}
              >
                Cancel paste
              </button>
            </div>
          </div>
        ) : null}

        {status && (
          <p className="text-sm text-accent" role="status" aria-live="polite">
            {status}
          </p>
        )}
        {errors.length > 0 && (
          <ul className="text-sm text-text-muted list-disc pl-5 space-y-1" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[640px]" aria-label={`${symbol} trade draft rows`}>
            <caption className="sr-only">
              Draft buy and sell rows for {symbol}. Edit cells, then save to update the journal.
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-text-subtle">
                <th className="py-2 pr-2 font-bold" scope="col">
                  Side
                </th>
                <th className="py-2 pr-2 font-bold" scope="col">
                  Date
                </th>
                <th className="py-2 pr-2 font-bold" scope="col">
                  Qty
                </th>
                <th className="py-2 pr-2 font-bold" scope="col">
                  Price
                </th>
                <th className="py-2 pr-2 font-bold" scope="col">
                  Fees
                </th>
                <th className="py-2 pr-2 font-bold" scope="col">
                  Notes
                </th>
                <th className="py-2 font-bold" scope="col">
                  <span className="sr-only">Remove row</span>
                </th>
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
                        className="btn-ghost btn-sm shrink-0 min-h-11 min-w-11"
                        title="Fill from market history"
                        aria-label={`Fill price from market history for ${r.date || 'selected date'}`}
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
                      className="btn-ghost btn-sm min-h-11 min-w-11"
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      disabled={rows.length <= 1}
                      aria-label="Remove row"
                    >
                      <span aria-hidden>✕</span>
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
