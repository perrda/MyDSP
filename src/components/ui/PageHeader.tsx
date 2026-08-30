import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

/** Capitalise a single token for headers (e.g. portfolios → Portfolios). */
export function titleCaseWord(word: string): string {
  if (!word) return word
  if (word === '&' || word === '/' || word === '-') return word
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Title-case each whitespace-separated word in a page header. */
export function titleCaseHeader(title: string): string {
  return title
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : titleCaseWord(part)))
    .join('')
}

/**
 * Page intro chrome — resize-safe across phone / tablet / web.
 * Stacks copy above actions by default; side-by-side only at ≥1024px with a
 * guaranteed min width on copy so description never collapses to one-word lines.
 * Phone: full eyebrow + title (shell title is hidden).
 * ≥sm: shell sticky title is visible — hide duplicate heading; keep description + actions.
 */
export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  const display = titleCaseHeader(title)
  const lastSpace = display.lastIndexOf(' ')
  const hasAccentSplit = lastSpace > 0
  const lead = hasAccentSplit ? display.slice(0, lastSpace) : ''
  const accent = hasAccentSplit ? display.slice(lastSpace + 1) : display

  return (
    <div className="page-header mb-6 md:mb-8">
      <div className="page-header__copy">
        <p className="eyebrow app-page-eyebrow mb-2 md:mb-3 sm:hidden">{eyebrow}</p>
        <h2 className="app-page-title font-bold tracking-tight leading-tight sm:hidden">
          {hasAccentSplit ? (
            <>
              {lead}{' '}
              <span className="gradient-text">{accent}</span>
            </>
          ) : (
            <span className="gradient-text">{accent}</span>
          )}
        </h2>
        {description && (
          <p className="page-header__description text-xs md:text-sm text-text-muted font-light leading-relaxed mt-2 md:mt-3 sm:mt-0">
            {description}
          </p>
        )}
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative'
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  const valueClass =
    tone === 'positive'
      ? 'text-accent'
      : tone === 'negative'
        ? 'text-text-muted'
        : 'text-text'

  return (
    <div className="surface fluid-metric p-5 sm:p-6 lg:p-8 h-full min-w-0">
      <p className="label-uppercase mb-3 sm:mb-4">{label}</p>
      <p
        className={`fluid-figure text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight tabular-nums ${valueClass}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-text-subtle font-light prose-card leading-snug">
          {hint}
        </p>
      )}
    </div>
  )
}
