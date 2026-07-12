import { useMemo, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { resolveCategory } from '../domain/merchantRules'
import type { MerchantMatchType, MerchantRule } from '../domain/types'

const CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'entertainment',
  'bills',
  'health',
  'travel',
  'subscriptions',
  'cash',
  'income',
  'other',
]

const MATCH_TYPES: MerchantMatchType[] = ['contains', 'startsWith', 'regex']

function nextId(items: { id: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1
}

const empty = {
  pattern: '',
  matchType: 'contains' as MerchantMatchType,
  category: 'other',
  priority: '10',
}

export function RulesPage() {
  const { data, setData } = usePortfolio()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MerchantRule | null>(null)
  const [form, setForm] = useState(empty)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [testDesc, setTestDesc] = useState('')

  const testResult = useMemo(
    () => (testDesc.trim() ? resolveCategory(testDesc, data.merchantRules) : null),
    [testDesc, data.merchantRules],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  const openEdit = (r: MerchantRule) => {
    setEditing(r)
    setForm({
      pattern: r.pattern,
      matchType: r.matchType,
      category: r.category,
      priority: String(r.priority ?? 0),
    })
    setOpen(true)
  }

  const save = () => {
    const rule: MerchantRule = {
      id: editing?.id ?? nextId(data.merchantRules),
      pattern: form.pattern.trim(),
      matchType: form.matchType,
      category: form.category,
      priority: Number(form.priority) || 0,
    }
    if (!rule.pattern) return
    setData((prev) => ({
      ...prev,
      merchantRules: editing
        ? prev.merchantRules.map((r) => (r.id === editing.id ? rule : r))
        : [...prev.merchantRules, rule],
    }))
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Import"
        title="Merchant rules"
        description="Match bank descriptions to categories. Higher priority wins."
        action={
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            Add rule
          </button>
        }
      />

      <div className="surface p-6 sm:p-8 mb-px">
        <p className="eyebrow mb-3">Test</p>
        <Field label="Sample description">
          <input
            type="text"
            value={testDesc}
            onChange={(e) => setTestDesc(e.target.value)}
            placeholder="TESCO STORES 2847"
          />
        </Field>
        {testResult && (
          <p className="mt-4 text-sm">
            Resolves to <span className="text-accent font-semibold uppercase tracking-wider">{testResult}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px">
        {[...data.merchantRules]
          .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
          .map((r) => (
            <div key={r.id} className="surface p-6">
              <p className="font-bold tracking-tight mb-1">{r.pattern}</p>
              <p className="text-sm text-text-subtle mb-4">
                {r.matchType} → <span className="text-accent uppercase text-xs font-bold tracking-widest">{r.category}</span>
                {' · '}priority {r.priority ?? 0}
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(r)}>
                  Edit
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setDeleteId(r.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        {data.merchantRules.length === 0 && (
          <div className="surface p-12 text-center text-text-subtle col-span-full">
            No rules yet — imports will use built-in keyword guesses.
          </div>
        )}
      </div>

      <Modal open={open} title={editing ? 'Edit rule' : 'Add rule'} onClose={() => setOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Pattern">
            <input
              type="text"
              required
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Match">
              <select
                value={form.matchType}
                onChange={(e) =>
                  setForm({ ...form, matchType: e.target.value as MerchantMatchType })
                }
              >
                {MATCH_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <input
                type="text"
                inputMode="numeric"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
        title="Delete rule"
        body="Remove this merchant rule?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return
          setData((prev) => ({
            ...prev,
            merchantRules: prev.merchantRules.filter((r) => r.id !== deleteId),
          }))
        }}
      />
    </div>
  )
}
