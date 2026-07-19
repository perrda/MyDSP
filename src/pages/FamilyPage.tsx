import { useMemo, useState } from 'react'
import { AllocationRing } from '../components/charts/AllocationRing'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { useToasts } from '../components/ToastProvider'
import { syncNow } from '../services/sync/autoSyncService'
import { calcBreakdown } from '../domain/calc'
import { calcFamilyTotals, type FamilyMemberType } from '../domain/family'
import type { FamilyMember } from '../domain/types'
import { loadPortfolio } from '../storage/portfolioStore'
import { formatGBP, privacyClass } from '../utils/format'

const TYPES: FamilyMemberType[] = ['primary', 'partner', 'child', 'other']

const empty = {
  name: '',
  role: 'Partner',
  type: 'partner' as FamilyMemberType,
  networth: '',
  assets: '',
  debt: '',
  portfolioId: '',
}

export function FamilyPage() {
  const { data, setData, breakdown, privacy, portfolios, activeId } = usePortfolio()
  const { success } = useToasts()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  const [form, setForm] = useState(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const portfolioBreakdowns = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcBreakdown>>()
    for (const p of portfolios) {
      try {
        if (p.id === activeId) map.set(p.id, breakdown)
        else map.set(p.id, calcBreakdown(loadPortfolio(p.id)))
      } catch {
        /* skip */
      }
    }
    return map
  }, [portfolios, activeId, breakdown])

  const totals = useMemo(
    () => calcFamilyTotals(breakdown, data.family, portfolioBreakdowns),
    [breakdown, data.family, portfolioBreakdowns],
  )

  const pieData = totals.contributions
    .filter((c) => c.netWorth !== 0)
    .map((c) => ({ name: c.name, value: Math.abs(c.netWorth) }))

  const hideMoney = privacy || data.family.settings.familyPrivacy

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  const openEdit = (m: FamilyMember) => {
    setEditing(m)
    setForm({
      name: m.name,
      role: m.role,
      type: m.type,
      networth: m.networth != null ? String(m.networth) : '',
      assets: m.assets != null ? String(m.assets) : '',
      debt: m.debt != null ? String(m.debt) : '',
      portfolioId: m.portfolioId ?? '',
    })
    setOpen(true)
  }

  const save = () => {
    const member: FamilyMember = {
      id: editing?.id ?? `member_${Date.now()}`,
      name: form.name.trim() || 'Member',
      role: form.role.trim() || 'Member',
      type: form.type,
      isActive: editing?.isActive ?? true,
      portfolioId: form.portfolioId || undefined,
      networth: form.networth ? parseNum(form.networth) : undefined,
      assets: form.assets ? parseNum(form.assets) : undefined,
      debt: form.debt ? parseNum(form.debt) : undefined,
    }
    setData((prev) => ({
      ...prev,
      family: {
        ...prev.family,
        members: editing
          ? prev.family.members.map((m) => (m.id === editing.id ? member : m))
          : [...prev.family.members, member],
      },
    }))
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Household"
        title="Family"
        description="Roll up household net worth across members — link portfolios or enter manual totals."
        action={
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            Add member
          </button>
        }
      />

      <div className="surface p-5 mb-px flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.family.settings.combined}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                family: {
                  ...prev.family,
                  settings: { ...prev.family.settings, combined: e.target.checked },
                },
              }))
            }
          />
          Show combined totals
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.family.settings.shareDebt}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                family: {
                  ...prev.family,
                  settings: { ...prev.family.settings, shareDebt: e.target.checked },
                },
              }))
            }
          />
          Include debt in rollup
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.family.settings.familyPrivacy}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                family: {
                  ...prev.family,
                  settings: { ...prev.family.settings, familyPrivacy: e.target.checked },
                },
              }))
            }
          />
          Hide family totals
        </label>
      </div>

      {data.family.settings.combined && (
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-px mb-8 ${privacyClass(hideMoney)}`}>
          <StatCard label="Household NW" value={formatGBP(totals.netWorth)} />
          <StatCard label="Household assets" value={formatGBP(totals.assets)} />
          <StatCard label="Household debt" value={formatGBP(totals.debt)} tone="negative" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-px mb-8">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-px">
          {data.family.members.map((m) => {
            const c = totals.contributions.find((x) => x.id === m.id)
            return (
              <div key={m.id} className={`surface p-6 ${!m.isActive ? 'opacity-50' : ''}`}>
                <div className="flex justify-between gap-2 mb-2">
                  <h3 className="font-bold tracking-tight">{m.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                    {m.type}
                  </span>
                </div>
                <p className="text-sm text-text-subtle mb-3">{m.role}</p>
                <p className={`text-xl font-bold tabular-nums mb-4 ${privacyClass(hideMoney)}`}>
                  {formatGBP(c?.netWorth ?? 0)}
                  {c ? (
                    <span className="text-sm font-normal text-text-subtle"> · {c.pct.toFixed(0)}%</span>
                  ) : null}
                </p>
                {m.portfolioId && (
                  <p className="text-xs text-text-subtle mb-3">
                    Linked: {portfolios.find((p) => p.id === m.portfolioId)?.name ?? m.portfolioId}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(m)}>
                    Edit
                  </button>
                  {m.id !== 'primary' && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setDeleteId(m.id)}>
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() =>
                      setData((prev) => ({
                        ...prev,
                        family: {
                          ...prev.family,
                          members: prev.family.members.map((x) =>
                            x.id === m.id ? { ...x, isActive: !x.isActive } : x,
                          ),
                        },
                      }))
                    }
                  >
                    {m.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="lg:col-span-2">
          <AllocationRing
            data={pieData}
            privacy={hideMoney}
            eyebrow="Contribution"
            title="Family net worth mix"
            donut
            emptyText="No active balances to chart."
          />
        </div>
      </div>

      <Modal open={open} title={editing ? 'Edit member' : 'Add member'} onClose={() => setOpen(false)}>
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
            <Field label="Role">
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as FamilyMemberType })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Link portfolio (optional)">
            <select
              value={form.portfolioId}
              onChange={(e) => setForm({ ...form, portfolioId: e.target.value })}
            >
              <option value="">Manual totals</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          {!form.portfolioId && form.type !== 'primary' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="NW £">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.networth}
                  onChange={(e) => setForm({ ...form, networth: e.target.value })}
                />
              </Field>
              <Field label="Assets £">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.assets}
                  onChange={(e) => setForm({ ...form, assets: e.target.value })}
                />
              </Field>
              <Field label="Debt £">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.debt}
                  onChange={(e) => setForm({ ...form, debt: e.target.value })}
                />
              </Field>
            </div>
          )}
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
        title="Delete member"
        body="Remove this family member from the household rollup?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return
          setData((prev) => ({
            ...prev,
            family: {
              ...prev.family,
              members: prev.family.members.filter((m) => m.id !== deleteId),
            },
          }))
        }}
      />

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary family actions">
        <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
          Add member
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            void syncNow().then(() => success('Sync now finished'))
          }}
        >
          Sync now
        </button>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
