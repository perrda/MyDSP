import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { ReorderHandle, ReorderList } from '../components/ui/Reorderable'
import { buildCashflowStory, formatRunwayMonths } from '../domain/cashflow'
import { MONEY_DIRECTORY, MONEY_DOORS } from '../domain/hubPages'
import { usePortfolio } from '../context/PortfolioContext'
import {
  loadHubLayout,
  orderHubDoors,
  saveHubLayout,
  subscribeHubLayout,
} from '../storage/hubLayoutStore'
import { formatGBP, privacyClass } from '../utils/format'

export function MoneyPage() {
  const { data, privacy } = usePortfolio()
  const story = useMemo(() => buildCashflowStory(data), [data])
  const leftoverTone = story.leftover > 0 ? 'positive' : story.leftover < 0 ? 'negative' : 'default'
  const [hubLayout, setHubLayout] = useState(loadHubLayout)
  useEffect(() => subscribeHubLayout(() => setHubLayout(loadHubLayout())), [])
  const doors = useMemo(
    () => orderHubDoors(MONEY_DOORS, hubLayout.moneyDoors),
    [hubLayout.moneyDoors],
  )
  const directory = useMemo(
    () => orderHubDoors(MONEY_DIRECTORY, hubLayout.moneyDirectory),
    [hubLayout.moneyDirectory],
  )

  return (
    <div className="money-home">
      <PageHeader
        eyebrow="Money"
        title="Money"
        description="Leftover and stables runway — then every Money page."
      />
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-px mb-8 ${privacyClass(privacy)}`}
        data-testid="money-cockpit"
      >
        <Link to="/cashflow" className="block min-w-0">
          <StatCard
            label="Leftover"
            value={formatGBP(story.leftover, { signed: true })}
            tone={leftoverTone}
            hint={story.book === 'ledger' ? 'This month’s ledger' : 'Recurring in − bills'}
          />
        </Link>
        <Link to="/cashflow" className="block min-w-0">
          <StatCard
            label="Runway"
            value={formatRunwayMonths(story.runway?.months ?? null)}
            hint={
              story.runway
                ? `Stables ${formatGBP(story.runway.cash)} ÷ bills ${formatGBP(story.runway.monthlyBills)}/mo`
                : 'No monthly bills — no runway'
            }
          />
        </Link>
      </div>
      <ReorderList
        items={doors}
        getId={(door) => door.to}
        onReorder={(next) => {
          setHubLayout(saveHubLayout({ moneyDoors: next.map((d) => d.to) }))
        }}
        className="money-cockpit-doors grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-px mb-8"
        itemClassName="min-w-0"
      >
        {(door) => (
          <div className="hub-tile surface surface-interactive p-4 md:p-5 rounded-xl md:rounded-none shadow-sm md:shadow-none min-w-0">
            <ReorderHandle label={`Reorder ${door.label}`} />
            <Link to={door.to} className="hub-tile__link min-w-0 flex-1 block">
              <p className="text-sm font-semibold tracking-tight truncate">{door.label}</p>
              <p className="text-xs text-text-muted font-light mt-1">{door.detail}</p>
            </Link>
          </div>
        )}
      </ReorderList>
      <h2 className="text-xs font-bold uppercase tracking-widest text-text-subtle mb-3">Directory</h2>
      <div data-testid="money-directory">
      <ReorderList
        items={directory}
        getId={(tile) => tile.to}
        onReorder={(next) => {
          setHubLayout(saveHubLayout({ moneyDirectory: next.map((d) => d.to) }))
        }}
        className="money-directory"
        itemClassName="min-w-0"
      >
        {(tile) => (
          <div
            className="hub-tile money-directory-tile surface surface-interactive p-4 md:p-5 rounded-xl shadow-sm min-w-0"
            data-testid="money-directory-tile"
          >
            <ReorderHandle label={`Reorder ${tile.label}`} />
            <Link to={tile.to} className="hub-tile__link min-w-0 flex-1 block">
              <p className="text-sm font-semibold tracking-tight truncate">{tile.label}</p>
              <p className="text-xs text-text-muted font-light mt-1">{tile.detail}</p>
            </Link>
          </div>
        )}
      </ReorderList>
      </div>
    </div>
  )
}
