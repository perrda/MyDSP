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
 * Page intro chrome.
 * Phone (&lt;768px): full eyebrow + title (shell title is hidden).
 * ≥md: shell sticky title is visible — hide duplicate heading; keep description + actions.
 * Actions sit beside the text block from md up so CTAs stay near the top.
 */
export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  const display = titleCaseHeader(title)
  const lastSpace = display.lastIndexOf(' ')
  const hasAccentSplit = lastSpace > 0
  const lead = hasAccentSplit ? display.slice(0, lastSpace) : ''
  const accent = hasAccentSplit ? display.slice(lastSpace + 1) : display

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4 mb-6 md:mb-8">
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-2 md:mb-3 text-xs md:text-sm md:hidden">{eyebrow}</p>
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-tight md:hidden">
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
          <p
            className={`text-xs md:text-sm text-text-muted font-light leading-relaxed max-w-2xl ${
              'mt-2 md:mt-0'
            }`}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 self-start">{action}</div>}
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
    <div className="surface p-5 sm:p-6 lg:p-8 h-full min-w-0">
      <p className="label-uppercase mb-3 sm:mb-4">{label}</p>
      <p
        className={`text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight tabular-nums break-words ${valueClass}`}
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
