import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AllocationRing } from '../components/charts/AllocationRing'
import { OverflowMenu } from '../components/ui/OverflowMenu'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { PagePrimaryActions } from '../components/ui/PagePrimaryActions'
import { HOUSEHOLD_DOORS } from '../domain/hubPages'
import { ConfirmDialog, Field, Modal, parseNum } from '../components/ui/Modal'
import { usePortfolio } from '../context/PortfolioContext'
import { calcFamilyTotals, type FamilyMemberType } from '../domain/family'
import { calcBreakdownWithPaper } from '../domain/netWorthWithPaper'
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
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  const [form, setForm] = useState(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const portfolioBreakdowns = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcBreakdownWithPaper>>()
    for (const p of portfolios) {
      try {
        if (p.id === activeId) map.set(p.id, breakdown)
        else map.set(p.id, calcBreakdownWithPaper(loadPortfolio(p.id)))
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
        title="Household"
        action={
          <PagePrimaryActions
            primaryLabel="Add member"
            onPrimary={openCreate}
            menuLabel="Household actions"
          />
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
              <div key={m.id} className={`surface p-4 sm:p-5 ${!m.isActive ? 'opacity-50' : ''}`}>
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
                <OverflowMenu
                  compact
                  label={`Actions for ${m.name}`}
                  items={[
                    { id: 'edit', label: 'Edit', onClick: () => openEdit(m) },
                    {
                      id: 'active',
                      label: m.isActive ? 'Deactivate' : 'Activate',
                      onClick: () =>
                        setData((prev) => ({
                          ...prev,
                          family: {
                            ...prev.family,
                            members: prev.family.members.map((x) =>
                              x.id === m.id ? { ...x, isActive: !x.isActive } : x,
                            ),
                          },
                        })),
                    },
                    ...(m.id !== 'primary'
                      ? [
                          {
                            id: 'delete',
                            label: 'Delete',
                            destructive: true,
                            onClick: () => setDeleteId(m.id),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            )
          })}
        </div>
        <div className="lg:col-span-2">
          <AllocationRing
            data={pieData}
            privacy={hideMoney}
            eyebrow="Contribution"
            title="Household mix"
            donut
            emptyText="No active balances to chart."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-px mb-8">
        {HOUSEHOLD_DOORS.map((door) => (
          <Link
            key={door.to}
            to={door.to}
            className="surface surface-interactive p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none block min-w-0"
          >
            <p className="text-sm font-semibold tracking-tight truncate">{door.label}</p>
            <p className="text-xs text-text-muted font-light mt-1">{door.detail}</p>
          </Link>
        ))}
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
              <Field label="NW (GBP)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.networth}
                  onChange={(e) => setForm({ ...form, networth: e.target.value })}
                />
              </Field>
              <Field label="Assets (GBP)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.assets}
                  onChange={(e) => setForm({ ...form, assets: e.target.value })}
                />
              </Field>
              <Field label="Debt (GBP)">
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

    </div>
  )
}
