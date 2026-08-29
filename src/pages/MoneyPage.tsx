import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { buildCashflowStory, formatRunwayMonths } from '../domain/cashflow'
import { MONEY_DOORS } from '../domain/hubPages'
import { usePortfolio } from '../context/PortfolioContext'
import { formatGBP, privacyClass } from '../utils/format'

export function MoneyPage() {
  const { data, privacy } = usePortfolio()
  const story = useMemo(() => buildCashflowStory(data), [data])
  const leftoverTone = story.leftover > 0 ? 'positive' : story.leftover < 0 ? 'negative' : 'default'

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Money"
        description="Leftover and stables runway — then Spend, Holdings, Tax, Import."
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-px">
        {MONEY_DOORS.map((door) => (
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
    </div>
  )
}
