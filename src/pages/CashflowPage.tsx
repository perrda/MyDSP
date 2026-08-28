import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CashflowChart } from '../components/charts/CashflowChart'
import { EmptyState, EmptyStateInline } from '../components/ui/EmptyState'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import { monthlyBudgetPulseFrom } from '../domain/budgetChart'
import {
  buildCashflowStory,
  formatRunwayMonths,
  hasCashflowSources,
} from '../domain/cashflow'
import { formatGBP, privacyClass } from '../utils/format'

const IN_HINT: Record<string, string> = {
  settings: 'Settings income',
  ledger: 'This month’s income rows',
  recurring: 'Recurring income',
  none: 'Add income in Settings or Spending',
}

const OUT_HINT: Record<string, string> = {
  recurring: 'Recurring bills',
  settings: 'Settings expenses',
  ledger: 'Average spend',
  none: 'Add recurring or spend',
}

export function CashflowPage() {
  const { data, privacy } = usePortfolio()
  const story = useMemo(() => buildCashflowStory(data), [data])
  const budgetPulse = useMemo(
    () => monthlyBudgetPulseFrom(data.spending, data.budgetGoals),
    [data.spending, data.budgetGoals],
  )
  const hasSources = hasCashflowSources(data)

  if (!hasSources) {
    return (
      <div>
        <PageHeader
          eyebrow="Money"
          title="Cashflow"
          description="One monthly story: money in, money out, leftover, and how long cash lasts if that holds."
        />
        <EmptyState
          illustration
          title="No cashflow yet"
          description="Need recurring bills or at least two months of spend before a plot. Income, spend, and runway stay on the existing ledger — this page does not invent a second one."
          action={{ label: 'Add recurring', to: '/recurring' }}
          secondaryAction={{ label: 'Log spend', to: '/spending' }}
        />
      </div>
    )
  }

  const leftoverTone = story.leftover > 0 ? 'positive' : story.leftover < 0 ? 'negative' : 'default'
  const leftoverHolds = story.leftover >= 0

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Cashflow"
        description="One monthly story from recurring, spending, and cash — not a second ledger."
      />

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}
        data-testid="cashflow-story"
      >
        <StatCard
          label="Money in"
          value={formatGBP(story.moneyIn)}
          hint={IN_HINT[story.inSource]}
        />
        <StatCard
          label="Money out"
          value={formatGBP(story.moneyOut)}
          hint={OUT_HINT[story.outSource]}
        />
        <StatCard
          label="Leftover"
          value={formatGBP(story.leftover, { signed: true })}
          tone={leftoverTone}
          hint={leftoverHolds ? 'If this holds, cash grows or stays' : 'If this holds, cash shrinks'}
        />
        <StatCard
          label="Cash lasts"
          value={formatRunwayMonths(story.runwayMonths)}
          hint={
            leftoverHolds
              ? `Cash ${formatGBP(story.cash)} · leftover holds`
              : `Cash ${formatGBP(story.cash)} ÷ leftover`
          }
        />
      </div>

      {story.canPlot ? (
        <CashflowChart months={story.months} privacy={privacy} />
      ) : (
        <div className="surface mb-6" data-testid="cashflow-chart-empty">
          <EmptyStateInline
            illustration
            message="Need two months of spend or income in the ledger before a plot. Recurring still sets this month’s run-rate above."
            action={{ label: 'Open Spending', to: '/spending' }}
          />
        </div>
      )}

      {budgetPulse ? (
        <Link
          to="/budgets"
          className={`block surface p-4 mb-6 text-sm hover:border-accent ${privacyClass(privacy)}`}
          data-testid="cashflow-budget-pulse"
        >
          <span className="label-uppercase">This month’s budget</span>
          <span className="block mt-1 tabular-nums">
            {formatGBP(budgetPulse.spent)} / {formatGBP(budgetPulse.totalBudget)} used
          </span>
        </Link>
      ) : null}

      <p className="text-xs text-text-subtle font-light leading-relaxed">
        Runway uses cash and stables, not net worth.{' '}
        <Link to="/spending" className="text-accent font-semibold">
          Spending
        </Link>
        {' · '}
        <Link to="/recurring" className="text-accent font-semibold">
          Recurring
        </Link>
        {' · '}
        <Link to="/budgets" className="text-accent font-semibold">
          Budgets
        </Link>
        {story.billsRunwayMonths != null ? (
          <span className="block mt-1 tabular-nums">
            Bills runway {formatRunwayMonths(story.billsRunwayMonths)} vs{' '}
            {formatGBP(story.moneyOut)}/mo
          </span>
        ) : null}
      </p>
    </div>
  )
}
