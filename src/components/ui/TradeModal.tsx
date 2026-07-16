import { useEffect, useState } from 'react'
import { Field, Modal, parseNum } from '../ui/Modal'
import type { TradeKind, TradeSide } from '../../domain/trades'
import { lookupPriceOnDate } from '../../domain/staticPrices'
import type { PortfolioData } from '../../domain/types'

interface Props {
  open: boolean
  kind: TradeKind
  symbol: string
  defaultPrice?: number
  defaultSide?: TradeSide
  /** Prefill when editing an existing journal trade. */
  initial?: {
    side: TradeSide
    date: string
    qty: number
    price: number
    fees: number
    notes?: string
    platform?: string
  }
  data?: PortfolioData
  /** Called on dismiss; `saved: true` after a successful journal save. */
  onClose: (opts?: { saved?: boolean }) => void
  onSave: (values: {
    side: TradeSide
    date: string
    qty: number
    price: number
    fees: number
    notes?: string
    platform?: string
  }) => void
}

export function TradeModal({
  open,
  kind,
  symbol,
  defaultPrice,
  defaultSide = 'buy',
  initial,
  data,
  onClose,
  onSave,
}: Props) {
  const [side, setSide] = useState<TradeSide>(defaultSide)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('0')
  const [notes, setNotes] = useState('')
  const [platform, setPlatform] = useState('')
  const [priceHint, setPriceHint] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setSide(initial.side)
      setDate(initial.date.slice(0, 10))
      setQty(String(initial.qty))
      setPrice(String(initial.price))
      setFees(String(initial.fees ?? 0))
      setNotes(initial.notes ?? '')
      setPlatform(initial.platform ?? '')
    } else {
      setSide(defaultSide)
      setDate(new Date().toISOString().slice(0, 10))
      setQty('')
      setPrice(defaultPrice && defaultPrice > 0 ? String(defaultPrice) : '')
      setFees('0')
      setNotes('')
      setPlatform('')
    }
    setPriceHint(null)
  }, [open]) // form reset on open; parent remounts via key when switching edit target

  const fillFromMarket = async (day: string) => {
    const hit = await lookupPriceOnDate(kind, symbol, day, data)
    if (!hit) {
      setPriceHint(`No close on/before ${day} for ${symbol}.`)
      return
    }
    setPrice(String(hit.price))
    setPriceHint(
      hit.date === day
        ? `Market close ${hit.price} on ${hit.date}`
        : `Nearest prior close ${hit.price} (${hit.date})`,
    )
  }

  return (
    <Modal
      open={open}
      title={`${initial ? 'Edit' : side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
      onClose={() => onClose()}
      size="sheet"
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          const q = parseNum(qty)
          const p = parseNum(price)
          const f = parseNum(fees)
          if (!(q > 0) || !(p >= 0)) return
          onSave({
            side,
            date,
            qty: q,
            price: p,
            fees: f,
            notes: notes.trim() || undefined,
            platform: platform.trim() || undefined,
          })
          onClose({ saved: true })
        }}
      >
        <p className="text-sm text-text-muted font-light">
          Records a dated {kind} trade in the journal and rebuilds this holding&apos;s quantity and
          average cost from all buys/sells.
        </p>
        <div className="flex gap-2">
          {(['buy', 'sell'] as TradeSide[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`btn-sm flex-1 ${side === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSide(s)}
            >
              {s === 'buy' ? 'Buy' : 'Sell'}
            </button>
          ))}
        </div>
        <Field label="Date" hint="Change date then tap “Fill market price” for TSLA / MSTR / BTC.">
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setPriceHint(null)
              }}
            />
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => void fillFromMarket(date)}
            >
              Fill market price
            </button>
          </div>
          {priceHint && <span className="mt-1.5 block text-[11px] text-accent">{priceHint}</span>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity">
            <input
              type="text"
              inputMode="decimal"
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Price (per unit)">
            <input
              type="text"
              inputMode="decimal"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Fees">
          <input
            type="text"
            inputMode="decimal"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
          />
        </Field>
        <Field label="Platform">
          <input
            type="text"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="Broker / exchange"
          />
        </Field>
        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={() => onClose()}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {initial ? 'Update trade' : `Save ${side}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
